import { createHash, randomUUID } from "node:crypto";
import { expect } from "vite-plus/test";
import type { createApp } from "../../../apps/api/src/index";

type App = ReturnType<typeof createApp>["app"];

export const MCP_ORIGIN = "http://localhost:5173";
export const MCP_PROTOCOL_VERSION = "2026-07-28";

export type McpConnection = {
  clientId: string;
  redirectUri: string;
  accessToken: string;
  refreshToken: string;
};

export type ApprovedMcpCode = {
  clientId: string;
  redirectUri: string;
  code: string;
  verifier: string;
};

type ConnectOptions = {
  clientName?: string;
  workspaceId?: string | null;
  redirectUri?: string;
};

type ApproverAuth = { cookie: string } | { bearer: string };

export const MCP_RESOURCE = "http://localhost:1337/api/mcp";

/** Register a client and start an authorization request; returns its id. */
export async function startMcpAuthorization(
  app: App,
  options: ConnectOptions = {},
) {
  const redirectUri = options.redirectUri ?? "http://127.0.0.1:43123/callback";
  const register = await app.request("/api/mcp/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      client_name: options.clientName ?? "Test agent",
      redirect_uris: [redirectUri],
      grant_types: ["authorization_code", "refresh_token"],
    }),
  });
  expect(register.status).toBe(200);
  const { client_id: clientId } = (await register.json()) as {
    client_id: string;
  };

  const verifier = `${randomUUID()}-${randomUUID()}`;
  const authorize = new URL("http://localhost/api/mcp/authorize");
  authorize.searchParams.set("response_type", "code");
  authorize.searchParams.set("client_id", clientId);
  authorize.searchParams.set("redirect_uri", redirectUri);
  authorize.searchParams.set(
    "code_challenge",
    createHash("sha256").update(verifier).digest("base64url"),
  );
  authorize.searchParams.set("code_challenge_method", "S256");
  authorize.searchParams.set("resource", MCP_RESOURCE);
  const started = await app.request(authorize.pathname + authorize.search, {
    redirect: "manual",
  });
  expect(started.status).toBe(302);
  const requestId =
    new URL(started.headers.get("location") ?? "").searchParams.get(
      "request_id",
    ) ?? "";
  return { clientId, redirectUri, verifier, requestId };
}

/** POST the consent decision for an authorization request. */
export function decideMcpAuthorization(
  app: App,
  auth: ApproverAuth,
  requestId: string,
  body: { approved: boolean; workspaceId?: string | null },
) {
  return app.request(`/api/mcp/authorize/request/${requestId}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: MCP_ORIGIN,
      ...("cookie" in auth
        ? { cookie: auth.cookie }
        : { authorization: `Bearer ${auth.bearer}` }),
    },
    body: JSON.stringify(body),
  });
}

/** Register, authorize and approve; stops before the code exchange. */
export async function approveMcpAgent(
  app: App,
  auth: ApproverAuth,
  options: ConnectOptions = {},
): Promise<ApprovedMcpCode> {
  const started = await startMcpAuthorization(app, options);
  const decision = await decideMcpAuthorization(app, auth, started.requestId, {
    approved: true,
    ...(options.workspaceId !== undefined
      ? { workspaceId: options.workspaceId }
      : {}),
  });
  expect(decision.status, await decision.clone().text()).toBe(200);
  const { redirect } = (await decision.json()) as { redirect: string };
  return {
    clientId: started.clientId,
    redirectUri: started.redirectUri,
    verifier: started.verifier,
    code: new URL(redirect).searchParams.get("code") ?? "",
  };
}

export function exchangeMcpCode(app: App, approved: ApprovedMcpCode) {
  return requestToken(app, {
    grant_type: "authorization_code",
    code: approved.code,
    client_id: approved.clientId,
    redirect_uri: approved.redirectUri,
    code_verifier: approved.verifier,
    resource: MCP_RESOURCE,
  });
}

/**
 * Run the real OAuth flow (DCR, authorize, consent, token) for a signed-in
 * user. `auth` is the approving browser credential: a cookie header or a
 * session bearer token.
 */
export async function connectMcpAgent(
  app: App,
  auth: ApproverAuth,
  options: ConnectOptions = {},
): Promise<McpConnection> {
  const approved = await approveMcpAgent(app, auth, options);
  const token = await exchangeMcpCode(app, approved);
  expect(token.status).toBe(200);
  const body = (await token.json()) as {
    access_token: string;
    refresh_token: string;
  };
  return {
    clientId: approved.clientId,
    redirectUri: approved.redirectUri,
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
  };
}

export function requestToken(app: App, params: Record<string, string>) {
  return app.request("/api/mcp/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
  });
}

export function refresh(app: App, connection: McpConnection, token?: string) {
  return requestToken(app, {
    grant_type: "refresh_token",
    refresh_token: token ?? connection.refreshToken,
    client_id: connection.clientId,
  });
}

/** POST one JSON-RPC message to /api/mcp with a bearer token. */
export function mcpPost(
  app: App,
  token: string,
  method: string,
  params: Record<string, unknown> = {},
  path = "/api/mcp",
) {
  const name = method === "tools/call" ? String(params.name ?? "") : undefined;
  return app.request(path, {
    method: "POST",
    headers: {
      accept: "application/json, text/event-stream",
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "mcp-method": method,
      "mcp-protocol-version": MCP_PROTOCOL_VERSION,
      ...(name ? { "mcp-name": name } : {}),
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method,
      params: {
        ...params,
        _meta: {
          "io.modelcontextprotocol/protocolVersion": MCP_PROTOCOL_VERSION,
          "io.modelcontextprotocol/clientInfo": {
            name: "baton-integration-test",
            version: "1.0.0",
          },
          "io.modelcontextprotocol/clientCapabilities": {},
        },
      },
    }),
  });
}

export async function rpcResult<T = unknown>(response: Response): Promise<T> {
  const text = await response.text();
  const data =
    text
      .split("\n")
      .find((line) => line.startsWith("data: "))
      ?.slice(6) ?? text;
  return (JSON.parse(data) as { result: T }).result;
}
