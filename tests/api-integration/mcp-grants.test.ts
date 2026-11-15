import { randomUUID } from "node:crypto";
import { and, eq, isNotNull } from "drizzle-orm";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { getClient } from "../../apps/api/src/mcp/oauth";
import { deleteExpiredStates } from "../../apps/api/src/mcp/oauth-store";
import { TOKEN_ATTEMPTS_PER_MINUTE } from "../../apps/api/src/mcp/token-attempts";
import { resetTestDatabase } from "./helpers/database";
import { signUpWithSession } from "./helpers/auth-session";
import {
  approveMcpAgent,
  connectMcpAgent,
  exchangeMcpCode,
  type McpConnection,
  mcpPost,
  refresh,
  requestToken,
  rpcResult,
} from "./helpers/mcp-oauth";

type App = ReturnType<typeof createApp>["app"];

beforeEach(resetTestDatabase);
afterEach(() => vi.unstubAllGlobals());

async function signUp(app: App, name = "Agent owner") {
  const response = await app.request("/api/auth/sign-up/email", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "http://localhost:5173",
    },
    body: JSON.stringify({
      name,
      email: `${randomUUID()}@example.com`,
      password: "mcp-grants-password",
    }),
  });
  expect(response.status).toBe(200);
  const body = (await response.json()) as {
    token: string;
    user: { id: string };
  };
  return { token: body.token, userId: body.user.id };
}

async function addWorkspace(userId: string, name: string) {
  const [workspace] = await db
    .insert(schema.workspaceTable)
    .values({
      id: `workspace-${randomUUID()}`,
      name,
      slug: `ws-${randomUUID()}`,
      createdAt: new Date(),
    })
    .returning();
  await db.insert(schema.workspaceUserTable).values({
    workspaceId: workspace!.id,
    userId,
    role: "owner",
    joinedAt: new Date(),
  });
  return workspace!;
}

/** MCP tools call REST over fetch; route those calls back into the app. */
function routeToolCallsInto(app: App) {
  const realFetch = globalThis.fetch;
  vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.pathname.startsWith("/api/"))
      return app.request(`${url.pathname}${url.search}`, init);
    return realFetch(input, init);
  });
}

async function callTool(
  app: App,
  token: string,
  name: string,
  args: Record<string, unknown> = {},
) {
  const response = await mcpPost(app, token, "tools/call", {
    name,
    arguments: args,
  });
  expect(response.status).toBe(200);
  return rpcResult<{ isError?: boolean; content: Array<{ text: string }> }>(
    response,
  );
}

async function grantOf(connection: McpConnection) {
  const [grant] = await db
    .select()
    .from(schema.mcpGrantTable)
    .where(eq(schema.mcpGrantTable.clientId, connection.clientId));
  return grant!;
}

const authorized = (app: App, token: string) =>
  app.request("/api/workspace", {
    headers: { authorization: `Bearer ${token}` },
  });

describe("MCP refresh tokens", () => {
  it("rotates: the new pair works and the access token reaches tools and REST", async () => {
    const { app } = createApp();
    const owner = await signUp(app);
    const agent = await connectMcpAgent(app, { bearer: owner.token });

    const response = await refresh(app, agent);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const next = (await response.json()) as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    };
    expect(next.refresh_token).not.toBe(agent.refreshToken);
    expect(next.expires_in).toBe(3600);
    expect((await mcpPost(app, next.access_token, "tools/list")).status).toBe(
      200,
    );
    expect((await authorized(app, next.access_token)).status).toBe(200);
    // The previous access token stays valid until it expires.
    expect((await authorized(app, agent.accessToken)).status).toBe(200);
  });

  it("accepts the old refresh token inside the grace window", async () => {
    const { app } = createApp();
    const owner = await signUp(app);
    const agent = await connectMcpAgent(app, { bearer: owner.token });
    expect((await refresh(app, agent)).status).toBe(200);
    const again = await refresh(app, agent);
    expect(again.status).toBe(200);
    expect((await grantOf(agent)).revokedAt).toBeNull();
  });

  it("revokes the grant when a rotated token is reused after the grace window", async () => {
    const { app } = createApp();
    const owner = await signUp(app);
    const agent = await connectMcpAgent(app, { bearer: owner.token });
    const rotated = (await (await refresh(app, agent)).json()) as {
      access_token: string;
      refresh_token: string;
    };
    await db
      .update(schema.mcpTokenTable)
      .set({ rotatedAt: new Date(Date.now() - 61_000) })
      .where(eq(schema.mcpTokenTable.grantId, (await grantOf(agent)).id));

    const reuse = await refresh(app, agent);
    expect(reuse.status).toBe(400);
    expect(await reuse.json()).toEqual({ error: "invalid_grant" });
    expect((await grantOf(agent)).revokedAt).not.toBeNull();
    // Every token of the grant is dead, including the newest pair.
    expect((await authorized(app, rotated.access_token)).status).toBe(401);
    expect((await refresh(app, agent, rotated.refresh_token)).status).toBe(400);
  });

  it("still revokes on reuse of a token rotated more than seven days ago", async () => {
    const { app } = createApp();
    const owner = await signUp(app);
    const agent = await connectMcpAgent(app, { bearer: owner.token });
    const r1 = (await (await refresh(app, agent)).json()) as {
      refresh_token: string;
    };
    // R0 was rotated eight days ago but has not reached its own expiry.
    await db
      .update(schema.mcpTokenTable)
      .set({ rotatedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000) })
      .where(
        and(
          eq(schema.mcpTokenTable.grantId, (await grantOf(agent)).id),
          isNotNull(schema.mcpTokenTable.rotatedAt),
        ),
      );
    // A refresh with the successor runs the cleanup.
    const r2Response = await refresh(app, agent, r1.refresh_token);
    expect(r2Response.status).toBe(200);
    const r2 = (await r2Response.json()) as {
      access_token: string;
      refresh_token: string;
    };

    const replay = await refresh(app, agent);
    expect(replay.status).toBe(400);
    expect(await replay.json()).toEqual({ error: "invalid_grant" });
    expect((await grantOf(agent)).revokedAt).not.toBeNull();
    expect((await refresh(app, agent, r2.refresh_token)).status).toBe(400);
    expect((await authorized(app, r2.access_token)).status).toBe(401);
  });

  it("lets two parallel refreshes with one shared token both succeed", async () => {
    const { app } = createApp();
    const owner = await signUp(app);
    const agent = await connectMcpAgent(app, { bearer: owner.token });
    const [first, second] = await Promise.all([
      refresh(app, agent),
      refresh(app, agent),
    ]);
    expect([first.status, second.status]).toEqual([200, 200]);
    const a = (await first.json()) as { refresh_token: string };
    const b = (await second.json()) as { refresh_token: string };
    expect(a.refresh_token).not.toBe(b.refresh_token);
    expect((await refresh(app, agent, a.refresh_token)).status).toBe(200);
    expect((await refresh(app, agent, b.refresh_token)).status).toBe(200);
    expect((await grantOf(agent)).revokedAt).toBeNull();
  });

  it.each(["wrong client", "idle-expired", "revoked"] as const)(
    "answers invalid_grant for a %s grant",
    async (state) => {
      const { app } = createApp();
      const owner = await signUp(app);
      const agent = await connectMcpAgent(app, { bearer: owner.token });
      const grant = await grantOf(agent);
      if (state === "idle-expired") {
        await db
          .update(schema.mcpGrantTable)
          .set({ idleExpiresAt: new Date(Date.now() - 1000) })
          .where(eq(schema.mcpGrantTable.id, grant.id));
      } else if (state === "revoked") {
        await db
          .update(schema.mcpGrantTable)
          .set({ revokedAt: new Date() })
          .where(eq(schema.mcpGrantTable.id, grant.id));
      }
      const other = await connectMcpAgent(app, { bearer: owner.token });
      const response =
        state === "wrong client"
          ? await refresh(app, { ...agent, clientId: other.clientId })
          : await refresh(app, agent);
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: "invalid_grant" });
      if (state !== "wrong client") {
        expect((await authorized(app, agent.accessToken)).status).toBe(401);
      }
    },
  );

  it("limits token attempts per registered client", async () => {
    const { app } = createApp();
    const owner = await signUp(app);
    const agent = await connectMcpAgent(app, { bearer: owner.token });
    // connectMcpAgent already spent one attempt on the code exchange.
    for (let i = 1; i < TOKEN_ATTEMPTS_PER_MINUTE; i++) {
      expect((await refresh(app, agent, "baton_mcp_rt_wrong")).status).toBe(
        400,
      );
    }
    const limited = await refresh(app, agent);
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).toBe("60");
    expect(limited.headers.get("cache-control")).toBe("no-store");
    // Another client is unaffected.
    const other = await connectMcpAgent(app, { bearer: owner.token });
    expect((await refresh(app, other)).status).toBe(200);
  });
});

describe("MCP access tokens", () => {
  it("answers an expired access token with 401 and the discovery challenge", async () => {
    const { app } = createApp();
    const owner = await signUp(app);
    const agent = await connectMcpAgent(app, { bearer: owner.token });
    await db
      .update(schema.mcpTokenTable)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(schema.mcpTokenTable.kind, "access"));
    const response = await mcpPost(app, agent.accessToken, "tools/list");
    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toContain(
      'resource_metadata="http://localhost:1337/.well-known/oauth-protected-resource/api/mcp"',
    );
    // The refresh token still renews it, with no browser.
    expect((await refresh(app, agent)).status).toBe(200);
  });

  it("refuses MCP tokens on the auth API and on session-only routes", async () => {
    const { app } = createApp();
    const owner = await signUp(app);
    const agent = await connectMcpAgent(app, { bearer: owner.token });
    for (const path of [
      "/api/auth/organization/list",
      "/api/auth/get-session",
      "/api/auth/list-sessions",
    ]) {
      const response = await app.request(path, {
        headers: { authorization: `Bearer ${agent.accessToken}` },
      });
      expect(response.status, `${path}: ${await response.clone().text()}`).toBe(
        401,
      );
    }
    expect(
      (
        await app.request("/api/user/sessions", {
          headers: { authorization: `Bearer ${agent.accessToken}` },
        })
      ).status,
    ).toBe(403);
  });

  it("never stores raw tokens", async () => {
    const { app } = createApp();
    const owner = await signUp(app);
    const agent = await connectMcpAgent(app, { bearer: owner.token });
    const stored = JSON.stringify(await db.select().from(schema.mcpTokenTable));
    expect(stored).not.toContain(agent.accessToken);
    expect(stored).not.toContain(agent.refreshToken);
    expect(
      await db
        .select()
        .from(schema.sessionTable)
        .where(eq(schema.sessionTable.userId, owner.userId)),
    ).toHaveLength(1);
  });

  it("stops working when the user is deleted", async () => {
    const { app } = createApp();
    const owner = await signUp(app);
    const agent = await connectMcpAgent(app, { bearer: owner.token });
    await db
      .delete(schema.userTable)
      .where(eq(schema.userTable.id, owner.userId));
    expect((await mcpPost(app, agent.accessToken, "tools/list")).status).toBe(
      401,
    );
    expect((await authorized(app, agent.accessToken)).status).toBe(401);
    expect(await db.select().from(schema.mcpGrantTable)).toHaveLength(0);
  });

  it("revokes every grant when the password is reset", async () => {
    const { app } = createApp();
    const owner = await signUp(app);
    const agent = await connectMcpAgent(app, { bearer: owner.token });
    const token = randomUUID();
    await db.insert(schema.verificationTable).values({
      id: randomUUID(),
      identifier: `reset-password:${token}`,
      value: owner.userId,
      expiresAt: new Date(Date.now() + 60_000),
    });
    const reset = await app.request("/api/auth/reset-password", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:5173",
      },
      body: JSON.stringify({ token, newPassword: "a-brand-new-password" }),
    });
    expect(reset.status).toBe(200);
    expect((await grantOf(agent)).revokedAt).not.toBeNull();
    expect((await authorized(app, agent.accessToken)).status).toBe(401);
    expect((await refresh(app, agent)).status).toBe(400);
  });

  it("revokes grants and voids pending codes when an admin sets the password", async () => {
    const { app } = createApp();
    const admin = await signUpWithSession(app, {
      email: `${randomUUID()}@example.com`,
      name: "Instance Admin",
      role: "admin",
    });
    const owner = await signUp(app);
    const agent = await connectMcpAgent(app, { bearer: owner.token });
    const pending = await approveMcpAgent(app, { bearer: owner.token });

    const reset = await app.request("/api/auth/admin/set-user-password", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: admin.cookies,
        origin: "http://localhost:5173",
      },
      body: JSON.stringify({
        userId: owner.userId,
        newPassword: "an-admin-chosen-password",
      }),
    });
    expect(reset.status, await reset.clone().text()).toBe(200);

    expect((await grantOf(agent)).revokedAt).not.toBeNull();
    expect((await authorized(app, agent.accessToken)).status).toBe(401);
    expect((await mcpPost(app, agent.accessToken, "tools/list")).status).toBe(
      401,
    );
    expect((await refresh(app, agent)).status).toBe(400);
    // The session survives an admin reset, but the code it approved does not.
    const exchanged = await exchangeMcpCode(app, pending);
    expect(exchanged.status).toBe(400);
    expect(await exchanged.json()).toEqual({ error: "invalid_grant" });
    expect(
      await db
        .select()
        .from(schema.mcpGrantTable)
        .where(eq(schema.mcpGrantTable.clientId, pending.clientId)),
    ).toHaveLength(0);
    // A new approval after the reset works.
    await connectMcpAgent(app, { bearer: owner.token });
  });

  it("accepts an API key on /api/mcp", async () => {
    const { app } = createApp();
    const owner = await signUp(app);
    const created = await app.request("/api/auth/api-key/create", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${owner.token}`,
        origin: "http://localhost:5173",
      },
      body: JSON.stringify({ name: "headless agent" }),
    });
    expect(created.status).toBe(200);
    const { key } = (await created.json()) as { key: string };
    expect((await mcpPost(app, key, "tools/list")).status).toBe(200);
    expect((await mcpPost(app, "not-a-key", "tools/list")).status).toBe(401);
  });
});

describe("MCP audience", () => {
  it("binds grants to the MCP endpoint and refuses another resource", async () => {
    const { app } = createApp();
    const owner = await signUp(app);
    const agent = await connectMcpAgent(app, { bearer: owner.token });
    expect((await grantOf(agent)).resource).toBe(
      "http://localhost:1337/api/mcp",
    );
    const response = await requestToken(app, {
      grant_type: "refresh_token",
      refresh_token: agent.refreshToken,
      client_id: agent.clientId,
      resource: "http://localhost:1337/api",
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid_target" });
  });
});

describe("MCP grants API", () => {
  it("lists only the caller's grants, and only the owner can revoke one", async () => {
    const { app } = createApp();
    const alice = await signUp(app, "Alice");
    const bob = await signUp(app, "Bob");
    const workspace = await addWorkspace(alice.userId, "Acme");
    const agent = await connectMcpAgent(
      app,
      { bearer: alice.token },
      { clientName: "Claude Code" },
    );
    const asBob = { authorization: `Bearer ${bob.token}` };
    const asAlice = { authorization: `Bearer ${alice.token}` };

    const aliceList = await app.request("/api/mcp/grants", {
      headers: asAlice,
    });
    expect(aliceList.status).toBe(200);
    const { grants, nextCursor } = (await aliceList.json()) as {
      grants: Array<Record<string, unknown>>;
      nextCursor: string | null;
    };
    expect(nextCursor).toBeNull();
    expect(grants).toEqual([
      {
        id: expect.any(String),
        clientName: "Claude Code",
        workspace: { id: workspace.id, name: "Acme" },
        createdAt: expect.any(String),
        lastUsedAt: expect.any(String),
      },
    ]);
    const grantId = grants[0]!.id as string;

    expect(
      await (await app.request("/api/mcp/grants", { headers: asBob })).json(),
    ).toEqual({ grants: [], nextCursor: null });
    const bobRevoke = await app.request(`/api/mcp/grants/${grantId}`, {
      method: "DELETE",
      headers: asBob,
    });
    expect(bobRevoke.status).toBe(404);
    expect((await authorized(app, agent.accessToken)).status).toBe(200);

    // An agent cannot manage grants with its own token.
    expect(
      (
        await app.request("/api/mcp/grants", {
          headers: { authorization: `Bearer ${agent.accessToken}` },
        })
      ).status,
    ).toBe(403);
    expect((await app.request("/api/mcp/grants")).status).toBe(401);

    const revoke = await app.request(`/api/mcp/grants/${grantId}`, {
      method: "DELETE",
      headers: asAlice,
    });
    expect(revoke.status).toBe(204);
    expect(
      (
        await app.request(`/api/mcp/grants/${grantId}`, {
          method: "DELETE",
          headers: asAlice,
        })
      ).status,
    ).toBe(404);
    expect(
      await (await app.request("/api/mcp/grants", { headers: asAlice })).json(),
    ).toEqual({ grants: [], nextCursor: null });
  });

  it.each([
    "removed",
    "custom role without workspace:read",
    "archived",
  ] as const)(
    "hides the default workspace once the caller is %s",
    async (change) => {
      const { app } = createApp();
      // The first account becomes the instance admin, who passes role checks.
      await signUp(app, "Instance admin");
      const owner = await signUp(app);
      const workspace = await addWorkspace(owner.userId, "Acme");
      await connectMcpAgent(app, { bearer: owner.token });
      const list = async () =>
        (await (
          await app.request("/api/mcp/grants", {
            headers: { authorization: `Bearer ${owner.token}` },
          })
        ).json()) as { grants: Array<{ id: string; workspace: unknown }> };
      expect((await list()).grants[0]?.workspace).toEqual({
        id: workspace.id,
        name: "Acme",
      });

      if (change === "removed") {
        await db
          .delete(schema.workspaceUserTable)
          .where(eq(schema.workspaceUserTable.workspaceId, workspace.id));
      } else if (change === "archived") {
        await db
          .update(schema.workspaceTable)
          .set({ archivedAt: new Date() })
          .where(eq(schema.workspaceTable.id, workspace.id));
      } else {
        await db
          .update(schema.workspaceUserTable)
          .set({ role: "contractor" })
          .where(eq(schema.workspaceUserTable.workspaceId, workspace.id));
        await db.insert(schema.workspaceRoleTable).values({
          workspaceId: workspace.id,
          role: "contractor",
          permission: JSON.stringify({ task: ["read"] }),
          createdAt: new Date(),
        });
      }
      await db
        .update(schema.workspaceTable)
        .set({ name: "Secret client" })
        .where(eq(schema.workspaceTable.id, workspace.id));

      const after = await list();
      // The grant stays visible and revocable; the workspace does not leak.
      expect(after.grants).toHaveLength(1);
      expect(after.grants[0]?.workspace).toBeNull();
      expect(JSON.stringify(after)).not.toContain("Secret client");
      expect(JSON.stringify(after)).not.toContain(workspace.id);
    },
  );

  it("pages through every live grant with a cursor", async () => {
    const { app } = createApp();
    const owner = await signUp(app);
    const base = Date.now() - 60_000;
    // Five grants; two share a creation time to exercise the id tiebreak.
    const created = [0, 1, 1, 2, 3].map((offset, index) => ({
      id: `grant-${index}`,
      userId: owner.userId,
      clientId: randomUUID(),
      clientName: `Agent ${index}`,
      resource: "http://localhost:1337/api/mcp",
      createdAt: new Date(base + offset * 1000),
      lastUsedAt: new Date(),
      idleExpiresAt: new Date(Date.now() + 60_000),
    }));
    await db.insert(schema.mcpGrantTable).values(created);
    const headers = { authorization: `Bearer ${owner.token}` };

    const seen: string[] = [];
    let cursor: string | null = null;
    let pages = 0;
    do {
      const query = new URLSearchParams({ limit: "2" });
      if (cursor) query.set("cursor", cursor);
      const response = await app.request(`/api/mcp/grants?${query}`, {
        headers,
      });
      expect(response.status).toBe(200);
      const page = (await response.json()) as {
        grants: Array<{ id: string }>;
        nextCursor: string | null;
      };
      expect(page.grants.length).toBeLessThanOrEqual(2);
      seen.push(...page.grants.map((grant) => grant.id));
      cursor = page.nextCursor;
      pages++;
    } while (cursor);
    expect(pages).toBe(3);
    expect(seen).toEqual([
      "grant-4",
      "grant-3",
      "grant-2",
      "grant-1",
      "grant-0",
    ]);

    for (const query of ["cursor=garbage", "limit=0", "limit=101"]) {
      expect(
        (await app.request(`/api/mcp/grants?${query}`, { headers })).status,
        query,
      ).toBe(400);
    }
  });

  it("revocation takes effect on the next call on another replica", async () => {
    const { app } = createApp();
    const owner = await signUp(app);
    const agent = await connectMcpAgent(app, { bearer: owner.token });
    vi.resetModules();
    const replica = (await import("../../apps/api/src/index")).createApp().app;
    expect((await authorized(replica, agent.accessToken)).status).toBe(200);
    const {
      grants: [grant],
    } = (await (
      await app.request("/api/mcp/grants", {
        headers: { authorization: `Bearer ${owner.token}` },
      })
    ).json()) as { grants: Array<{ id: string }> };
    await app.request(`/api/mcp/grants/${grant!.id}`, {
      method: "DELETE",
      headers: { authorization: `Bearer ${owner.token}` },
    });
    expect((await authorized(replica, agent.accessToken)).status).toBe(401);
    expect(
      (await mcpPost(replica, agent.accessToken, "tools/list")).status,
    ).toBe(401);
  });

  it("does not touch agents when the user signs out other sessions", async () => {
    const { app } = createApp();
    const owner = await signUp(app);
    const agent = await connectMcpAgent(app, { bearer: owner.token });
    const response = await app.request("/api/auth/revoke-sessions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${owner.token}`,
        origin: "http://localhost:5173",
      },
    });
    expect(response.status).toBe(200);
    expect((await authorized(app, agent.accessToken)).status).toBe(200);
  });
});

describe("MCP client registrations", () => {
  it("keeps a client alive while a grant uses it", async () => {
    const { app } = createApp();
    const owner = await signUp(app);
    const agent = await connectMcpAgent(app, { bearer: owner.token });
    const [row] = await db
      .select()
      .from(schema.mcpOauthStateTable)
      .where(
        and(
          eq(schema.mcpOauthStateTable.kind, "client"),
          eq(schema.mcpOauthStateTable.key, agent.clientId),
        ),
      );
    // Registration lives 30 days; the grant extends it to its idle expiry.
    expect(row!.expiresAt.getTime()).toBeGreaterThan(
      Date.now() + 80 * 24 * 60 * 60 * 1000,
    );
    await deleteExpiredStates();
    await expect(getClient(agent.clientId)).resolves.not.toBeNull();
  });
});

describe("MCP default workspace", () => {
  it("uses the workspace chosen on the consent page and refuses a foreign one", async () => {
    const { app } = createApp();
    routeToolCallsInto(app);
    const owner = await signUp(app);
    const stranger = await signUp(app, "Stranger");
    await addWorkspace(owner.userId, "Acme");
    const side = await addWorkspace(owner.userId, "Side");
    const foreign = await addWorkspace(stranger.userId, "Theirs");

    const agent = await connectMcpAgent(
      app,
      { bearer: owner.token },
      { workspaceId: side.id },
    );
    expect((await grantOf(agent)).defaultWorkspaceId).toBe(side.id);
    const mine = await callTool(app, agent.accessToken, "list_my_tasks");
    expect(mine.isError, mine.content[0]?.text).toBeFalsy();

    await expect(
      connectMcpAgent(
        app,
        { bearer: owner.token },
        { workspaceId: foreign.id },
      ),
    ).rejects.toThrow();
  });

  it("lists workspace names when there are several and no default", async () => {
    const { app } = createApp();
    routeToolCallsInto(app);
    const owner = await signUp(app);
    await addWorkspace(owner.userId, "Acme");
    await addWorkspace(owner.userId, "Side");
    const agent = await connectMcpAgent(app, { bearer: owner.token });
    expect((await grantOf(agent)).defaultWorkspaceId).toBeNull();

    const result = await callTool(app, agent.accessToken, "list_my_tasks");
    expect(result.isError).toBe(true);
    expect(result.content[0]?.text).toMatch(/Acme.*Side/);

    const named = await callTool(app, agent.accessToken, "list_my_tasks", {
      workspaceId: "side",
    });
    expect(named.isError, named.content[0]?.text).toBeFalsy();
  });

  it("defaults to the only workspace without asking", async () => {
    const { app } = createApp();
    const owner = await signUp(app);
    const only = await addWorkspace(owner.userId, "Solo");
    const agent = await connectMcpAgent(app, { bearer: owner.token });
    expect((await grantOf(agent)).defaultWorkspaceId).toBe(only.id);
  });
});
