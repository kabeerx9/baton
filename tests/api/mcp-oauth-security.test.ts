import { createHash } from "node:crypto";
import { HTTPException } from "hono/http-exception";
import { describe, expect, it, vi } from "vite-plus/test";

const mocks = vi.hoisted(() => {
  const insertedRows: Array<Record<string, unknown>> = [];
  const getSession = vi.fn(async ({ headers }: { headers: Headers }) => {
    const cookie = new Headers(headers).get("cookie") ?? "";
    if (cookie.includes("victim_session=1")) {
      return {
        user: { id: "victim-user" },
        session: { id: "victim-session", token: "victim-cookie-token" },
      };
    }
    return null;
  });
  const insert = vi.fn(() => ({
    values: vi.fn(
      (rows: Record<string, unknown> | Array<Record<string, unknown>>) => {
        insertedRows.push(...(Array.isArray(rows) ? rows : [rows]));
        return Object.assign(Promise.resolve(), {
          returning: async () => [{ id: "grant-1" }],
        });
      },
    ),
  }));
  const write = () => ({ where: async () => [] });
  const update = vi.fn(() => ({ set: write }));
  const remove = vi.fn(write);
  const select = vi.fn(() => ({
    from: () => ({
      where: () => ({
        // Awaited directly (credential account lookup): no password set.
        limit: () =>
          Object.assign(Promise.resolve([]), {
            for: async () => [
              {
                id: "victim-session",
                expiresAt: new Date(Date.now() + 60_000),
              },
            ],
          }),
      }),
    }),
  }));
  return { getSession, insert, select, update, remove, insertedRows };
});

vi.mock("../../apps/api/src/auth", () => ({
  auth: { api: { getSession: mocks.getSession } },
}));

vi.mock("../../apps/api/src/database", async () => ({
  default: {
    // Consent reads the password generation outside a transaction.
    select: mocks.select,
    transaction: async (callback: (tx: unknown) => Promise<unknown>) =>
      callback({
        insert: mocks.insert,
        select: mocks.select,
        update: mocks.update,
        delete: mocks.remove,
      }),
  },
  schema: await import("../../apps/api/src/database/schema"),
}));

vi.mock("../../apps/api/src/mcp/tools", () => ({
  registerMcpTools: vi.fn(),
}));

vi.mock("../../apps/api/src/workspace/controllers/list-workspaces", () => ({
  default: async () => [],
}));

vi.mock("../../apps/api/src/mcp/token-attempts", () => ({
  takeTokenAttempt: async () => true,
}));

vi.mock("../../apps/api/src/mcp/oauth-store", () => {
  const rows = new Map<string, { payload: unknown; expiresAt: Date }>();
  const keyOf = (kind: string, key: string) => `${kind}:${key}`;
  return {
    putState: async (
      kind: string,
      key: string,
      payload: unknown,
      expiresAt: Date,
      requestId?: string,
    ) => {
      if (requestId) {
        if (!rows.delete(keyOf("request", requestId)))
          throw new HTTPException(404);
      }
      rows.set(keyOf(kind, key), { payload, expiresAt });
    },
    getState: async (kind: string, key: string) => {
      const row = rows.get(keyOf(kind, key));
      if (!row) return null;
      if (row.expiresAt.getTime() < Date.now()) return null;
      return row.payload;
    },
    consumeState: async (kind: string, key: string) => {
      const row = rows.get(keyOf(kind, key));
      rows.delete(keyOf(kind, key));
      if (!row) return null;
      if (row.expiresAt.getTime() < Date.now()) return null;
      return row.payload;
    },
    deleteExpiredStates: async () => {
      const now = Date.now();
      for (const [key, row] of rows) {
        if (row.expiresAt.getTime() < now) rows.delete(key);
      }
    },
  };
});

import mcpRoutes from "../../apps/api/src/mcp";
import {
  createAuthorizationRequest,
  getAuthorizationRequest,
} from "../../apps/api/src/mcp/oauth";

const clientUrl = process.env.BATON_CLIENT_URL || "http://localhost:5173";
const clientOrigin = new URL(clientUrl).origin;

function challengeFor(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

async function registerClient(redirectUri: string) {
  const response = await mcpRoutes.request("/mcp/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      client_name: "Test MCP client",
      redirect_uris: [redirectUri],
    }),
  });
  expect(response.status).toBe(200);
  return (await response.json()) as { client_id: string };
}

function buildAuthorizeUrl(
  clientId: string,
  redirectUri: string,
  verifier: string,
  state: string | undefined = "client-state",
) {
  const url = new URL("http://api.local/mcp/authorize");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("code_challenge", challengeFor(verifier));
  url.searchParams.set("code_challenge_method", "S256");
  if (state !== undefined) url.searchParams.set("state", state);
  return url;
}

async function decideAuthorization(params: {
  clientId: string;
  redirectUri: string;
  verifier: string;
  approved: boolean;
  state?: string;
}) {
  const authorizeUrl = buildAuthorizeUrl(
    params.clientId,
    params.redirectUri,
    params.verifier,
    params.state,
  );
  const authorize = await mcpRoutes.request(authorizeUrl.toString(), {
    redirect: "manual",
  });
  expect(authorize.status).toBe(302);
  const consentUrl = new URL(authorize.headers.get("location") ?? "");
  const requestId = consentUrl.searchParams.get("request_id");
  expect(requestId).toBeTruthy();

  const decision = await mcpRoutes.request(
    `/mcp/authorize/request/${requestId}`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: "victim_session=1",
        origin: clientOrigin,
      },
      body: JSON.stringify({ approved: params.approved }),
    },
  );
  expect(decision.status).toBe(200);
  const body = (await decision.json()) as { redirect: string };
  return new URL(body.redirect);
}

describe("MCP OAuth security", () => {
  it("rejects empty and unsafe redirect URI registrations", async () => {
    const empty = await mcpRoutes.request("/mcp/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ redirect_uris: [] }),
    });
    expect(empty.status).toBe(400);

    const remoteHttp = await mcpRoutes.request("/mcp/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        redirect_uris: ["http://attacker.example/callback"],
      }),
    });
    expect(remoteHttp.status).toBe(400);
  });

  it("accepts Claude-style registration metadata and grants refresh tokens", async () => {
    const response = await mcpRoutes.request("/mcp/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        client_name: "Claude",
        redirect_uris: ["https://claude.ai/api/mcp/auth_callback"],
        token_endpoint_auth_method: "none",
        grant_types: ["authorization_code", "refresh_token"],
        response_types: ["code"],
        client_uri: "https://claude.ai",
      }),
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    });
  });

  it("returns RFC 7591 JSON errors for invalid registration metadata", async () => {
    const missingGrant = await mcpRoutes.request("/mcp/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        redirect_uris: ["https://client.example/callback"],
        grant_types: ["refresh_token"],
      }),
    });
    expect(missingGrant.status).toBe(400);
    await expect(missingGrant.json()).resolves.toMatchObject({
      error: "invalid_client_metadata",
    });

    const badRedirect = await mcpRoutes.request("/mcp/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        redirect_uris: ["http://attacker.example/callback"],
      }),
    });
    expect(badRedirect.status).toBe(400);
    await expect(badRedirect.json()).resolves.toMatchObject({
      error: "invalid_redirect_uri",
    });
  });

  it("returns RFC 6749 JSON errors for malformed authorization requests", async () => {
    const response = await mcpRoutes.request(
      "/mcp/authorize?response_type=code&client_id=x&redirect_uri=https%3A%2F%2Fclient.example%2Fcb&code_challenge=abc&code_challenge_method=plain",
      { redirect: "manual" },
    );
    expect(response.status).toBe(400);
    expect(response.headers.get("content-type")).toContain("application/json");
    await expect(response.json()).resolves.toMatchObject({
      error: "invalid_request",
    });
  });

  it("requires an exact registered redirect URI", async () => {
    const registeredRedirect = "https://client.example/callback";
    const client = await registerClient(registeredRedirect);
    const authorizeUrl = buildAuthorizeUrl(
      client.client_id,
      "https://attacker.example/collect",
      "verifier-for-redirect-check",
    );

    const response = await mcpRoutes.request(authorizeUrl.toString(), {
      redirect: "manual",
    });
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "invalid_redirect_uri",
    });
  });

  it("requires explicit same-origin approval before issuing a code", async () => {
    const redirectUri = "https://client.example/callback";
    const verifier = "attacker-known-verifier-1234567890-padded-to-43";
    const client = await registerClient(redirectUri);
    const authorizeUrl = buildAuthorizeUrl(
      client.client_id,
      redirectUri,
      verifier,
    );

    const authorize = await mcpRoutes.request(authorizeUrl.toString(), {
      headers: { cookie: "victim_session=1" },
      redirect: "manual",
    });
    expect(authorize.status).toBe(302);
    const consentUrl = new URL(authorize.headers.get("location") ?? "");
    expect(consentUrl.origin).toBe(clientOrigin);
    expect(consentUrl.pathname).toBe("/mcp/authorize");
    expect(consentUrl.searchParams.has("code")).toBe(false);
    expect(mocks.getSession).not.toHaveBeenCalled();

    const requestId = consentUrl.searchParams.get("request_id");
    expect(requestId).toBeTruthy();

    const crossOriginDecision = await mcpRoutes.request(
      `/mcp/authorize/request/${requestId}`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: "victim_session=1",
          origin: "https://attacker.example",
        },
        body: JSON.stringify({ approved: true }),
      },
    );
    expect(crossOriginDecision.status).toBe(403);

    const unauthenticatedDecision = await mcpRoutes.request(
      `/mcp/authorize/request/${requestId}`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: clientOrigin,
        },
        body: JSON.stringify({ approved: true }),
      },
    );
    expect(unauthenticatedDecision.status).toBe(401);

    const approval = await mcpRoutes.request(
      `/mcp/authorize/request/${requestId}`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: "victim_session=1",
          origin: clientOrigin,
        },
        body: JSON.stringify({ approved: true }),
      },
    );
    expect(approval.status).toBe(200);
    const approvalBody = (await approval.json()) as { redirect: string };
    const callback = new URL(approvalBody.redirect);
    expect(callback.origin + callback.pathname).toBe(redirectUri);
    expect(callback.searchParams.get("state")).toBe("client-state");
    const code = callback.searchParams.get("code");
    expect(code).toBeTruthy();

    const token = await mcpRoutes.request("/mcp/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: code ?? "",
        client_id: client.client_id,
        redirect_uri: redirectUri,
        code_verifier: verifier,
      }),
    });
    expect(token.status).toBe(200);
    expect(token.headers.get("cache-control")).toBe("no-store");
    expect(token.headers.get("pragma")).toBe("no-cache");
    const issued = (await token.json()) as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    };
    expect(issued.expires_in).toBe(3600);
    expect(issued.refresh_token).toMatch(/^baton_mcp_rt_/);
    expect(callback.searchParams.get("iss")).toBe("http://localhost:1337/api");
    const grant = mocks.insertedRows.find((row) => "clientId" in row);
    expect(grant).toMatchObject({
      userId: "victim-user",
      clientName: "Test MCP client",
      resource: "http://localhost:1337/api/mcp",
    });
    // Only hashes reach the database, never the tokens themselves.
    const stored = JSON.stringify(mocks.insertedRows);
    expect(stored).not.toContain(issued.access_token);
    expect(stored).not.toContain(issued.refresh_token);
    expect(mocks.insertedRows.filter((row) => "tokenHash" in row)).toHaveLength(
      2,
    );

    const replay = await mcpRoutes.request(
      `/mcp/authorize/request/${requestId}`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: "victim_session=1",
          origin: clientOrigin,
        },
        body: JSON.stringify({ approved: true }),
      },
    );
    expect(replay.status).toBe(404);
  });

  it("preserves an explicitly empty state value", async () => {
    const redirectUri = "https://client.example/empty-state";
    const client = await registerClient(redirectUri);
    const callback = await decideAuthorization({
      clientId: client.client_id,
      redirectUri,
      verifier: "empty-state-verifier",
      approved: false,
      state: "",
    });

    expect(callback.searchParams.get("error")).toBe("access_denied");
    expect(callback.searchParams.has("state")).toBe(true);
    expect(callback.searchParams.get("state")).toBe("");
  });

  it("consumes an authorization code after a failed redemption attempt", async () => {
    const redirectUri = "https://client.example/single-use";
    const verifier = "single-use-verifier-padded-to-the-rfc-minimum";
    const client = await registerClient(redirectUri);
    const callback = await decideAuthorization({
      clientId: client.client_id,
      redirectUri,
      verifier,
      approved: true,
    });
    const code = callback.searchParams.get("code") ?? "";

    const redeem = (codeVerifier: string) =>
      mcpRoutes.request("/mcp/token", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          client_id: client.client_id,
          redirect_uri: redirectUri,
          code_verifier: codeVerifier,
        }),
      });

    expect(
      (await redeem("incorrect-verifier-padded-to-the-rfc-minimum")).status,
    ).toBe(400);
    expect((await redeem(verifier)).status).toBe(400);
  });

  it("shows an HTML reconnect page for an unknown client", async () => {
    const response = await mcpRoutes.request(
      buildAuthorizeUrl(
        "forgotten-client",
        "http://127.0.0.1:4000/callback",
        "unknown-client-verifier",
      ).toString(),
      { redirect: "manual" },
    );
    expect(response.status).toBe(400);
    expect(response.headers.get("content-type")).toContain("text/html");
    expect(await response.text()).toContain("Reconnect your agent");
  });

  it("matches a loopback redirect on any port, but not another path or host", async () => {
    const client = await registerClient("http://127.0.0.1:3000/callback");
    const authorize = (redirectUri: string) =>
      mcpRoutes.request(
        buildAuthorizeUrl(
          client.client_id,
          redirectUri,
          "loopback-verifier",
        ).toString(),
        { redirect: "manual" },
      );
    expect((await authorize("http://127.0.0.1:53682/callback")).status).toBe(
      302,
    );
    expect((await authorize("http://127.0.0.1:53682/other")).status).toBe(400);
    expect((await authorize("http://localhost:53682/callback")).status).toBe(
      400,
    );
  });

  it("returns invalid_target with iss for a foreign resource", async () => {
    const redirectUri = "https://client.example/target";
    const client = await registerClient(redirectUri);
    const url = buildAuthorizeUrl(client.client_id, redirectUri, "target-v");
    url.searchParams.set("resource", "https://other.example/api/mcp");
    const response = await mcpRoutes.request(url.toString(), {
      redirect: "manual",
    });
    expect(response.status).toBe(302);
    const callback = new URL(response.headers.get("location") ?? "");
    expect(callback.origin + callback.pathname).toBe(redirectUri);
    expect(callback.searchParams.get("error")).toBe("invalid_target");
    expect(callback.searchParams.get("iss")).toBe("http://localhost:1337/api");
    expect(callback.searchParams.get("state")).toBe("client-state");

    url.searchParams.set("resource", "http://localhost:1337/api/mcp");
    const accepted = await mcpRoutes.request(url.toString(), {
      redirect: "manual",
    });
    expect(new URL(accepted.headers.get("location") ?? "").pathname).toBe(
      "/mcp/authorize",
    );
  });

  it("answers token errors with no-store and checks verifier syntax and resource", async () => {
    const token = (params: Record<string, string>) =>
      mcpRoutes.request("/mcp/token", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code: "unknown-code",
          client_id: "client",
          redirect_uri: "https://client.example/cb",
          code_verifier: "v".repeat(43),
          ...params,
        }),
      });
    const shortVerifier = await token({ code_verifier: "v".repeat(42) });
    expect(shortVerifier.status).toBe(400);
    expect(shortVerifier.headers.get("cache-control")).toBe("no-store");
    expect(shortVerifier.headers.get("pragma")).toBe("no-cache");
    await expect(shortVerifier.json()).resolves.toEqual({
      error: "invalid_request",
    });
    await expect(
      (await token({ resource: "https://evil.example/api/mcp" })).json(),
    ).resolves.toEqual({ error: "invalid_target" });
    await expect((await token({})).json()).resolves.toEqual({
      error: "invalid_grant",
    });
    await expect(
      (await token({ grant_type: "client_credentials" })).json(),
    ).resolves.toEqual({ error: "unsupported_grant_type" });
  });

  it("advertises both grants and issuer responses", async () => {
    const metadata = await (
      await mcpRoutes.request("/.well-known/oauth-authorization-server/api")
    ).json();
    expect(metadata).toMatchObject({
      grant_types_supported: ["authorization_code", "refresh_token"],
      authorization_response_iss_parameter_supported: true,
    });
  });

  it("sweeps expired authorization requests when creating a new one", async () => {
    const now = Date.now();
    vi.useFakeTimers();
    try {
      vi.setSystemTime(now);
      const expiredRequestId = await createAuthorizationRequest({
        clientId: "client-expired",
        redirectUri: "https://client.example/expired",
        codeChallenge: "challenge",
      });

      vi.setSystemTime(now + 10 * 60 * 1000 + 1);
      await createAuthorizationRequest({
        clientId: "client-current",
        redirectUri: "https://client.example/current",
        codeChallenge: "challenge",
      });

      await expect(
        getAuthorizationRequest(expiredRequestId),
      ).resolves.toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
