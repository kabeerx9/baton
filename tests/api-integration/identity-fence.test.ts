import { eq } from "drizzle-orm";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { identity, identityHolder } from "../../apps/api/src/identity";
import { batonIdentityHooks } from "../../apps/api/src/identity/baton-hooks";
import { createBetterAuthIdentity } from "../../apps/api/src/identity/better-auth/adapter";
import { auth } from "../../apps/api/src/identity/better-auth/auth";
import type { createApp } from "../../apps/api/src/index";
import {
  initializeWebSocketAdapter,
  isSessionRecheckRunning,
  SESSION_RECHECK_CHUNK,
  SESSION_RECHECK_MS,
  shutdownWebSocketAdapter,
} from "../../apps/api/src/ws";
import { adminWithTarget } from "./helpers/admin/admin-users-api";
import { readAuditLog } from "./helpers/admin/read-audit-log";
import { signIn } from "./helpers/auth-session";
import { resetTestDatabase } from "./helpers/database";
import {
  approveMcpAgent,
  type ApprovedMcpCode,
  exchangeMcpCode,
} from "./helpers/mcp-oauth";
import { holdRowLock, releaseWhenQueued } from "./helpers/row-lock";
import {
  connectSocket,
  disconnectSockets,
  meStatus,
  sessionIdOf,
} from "./helpers/sessions/session-fixtures";

type App = ReturnType<typeof createApp>["app"];

const PASSWORD = "correct horse battery staple";
const origin = "http://localhost:5173";

// "Killed before commit" fails the audit insert inside the transaction;
// "killed after commit" and a failed cross-instance send both fail the
// socket fan-out that runs after the commit, before any local close.
const failures = vi.hoisted(() => ({ audit: false, socketFanOut: false }));
vi.mock(
  "../../apps/api/src/admin/audit/record-admin-action",
  async (original) => {
    const actual =
      await original<
        typeof import("../../apps/api/src/admin/audit/record-admin-action")
      >();
    return {
      ...actual,
      recordAdminAction: async (
        ...args: Parameters<typeof actual.recordAdminAction>
      ) => {
        if (failures.audit) throw new Error("killed before commit");
        return actual.recordAdminAction(...args);
      },
    };
  },
);
vi.mock("../../apps/api/src/ws", async (original) => {
  const actual = await original<typeof import("../../apps/api/src/ws")>();
  return {
    ...actual,
    revokeSessionConnections: async (
      ...args: Parameters<typeof actual.revokeSessionConnections>
    ) => {
      if (failures.socketFanOut) throw new Error("socket fan-out failed");
      return actual.revokeSessionConnections(...args);
    },
  };
});

beforeEach(async () => {
  failures.audit = false;
  failures.socketFanOut = false;
  await resetTestDatabase();
});

afterEach(async () => {
  disconnectSockets();
  vi.useRealTimers();
  await shutdownWebSocketAdapter();
});

async function setup() {
  const world = await adminWithTarget();
  const targetSessionId = await sessionIdOf(world.target.cookies);
  return { ...world, targetSessionId };
}

function post(app: App, path: string, cookies: string, body: unknown = {}) {
  return app.request(path, {
    method: "POST",
    headers: { "content-type": "application/json", cookie: cookies, origin },
    body: JSON.stringify(body),
  });
}

async function tokenOf(response: Response) {
  expect(response.status, await response.clone().text()).toBe(200);
  return ((await response.json()) as { access_token: string }).access_token;
}

function restStatus(app: App, accessToken: string) {
  return app
    .request("/api/workspace", {
      headers: { authorization: `Bearer ${accessToken}` },
    })
    .then((response) => response.status);
}

async function grantsOf(userId: string) {
  return db
    .select({ revokedAt: schema.mcpGrantTable.revokedAt })
    .from(schema.mcpGrantTable)
    .where(eq(schema.mcpGrantTable.userId, userId));
}

async function resetPassword(app: App, userId: string) {
  const link = await identity.credentials.passwordSetupLink(userId, "reset");
  const token = new URL(link).pathname.split("/").pop();
  const response = await app.request("/api/auth/reset-password", {
    method: "POST",
    headers: { "content-type": "application/json", origin },
    body: JSON.stringify({ token, newPassword: "a-brand-new-password" }),
  });
  expect(response.status, await response.clone().text()).toBe(200);
}

describe("P2 A2: MCP code redemption races, order fixed by the user row lock", () => {
  type World = Awaited<ReturnType<typeof setup>>;
  type Ending = {
    name: string;
    /** The session that approves the code and is then ended. */
    approver: (world: World) => Promise<{ cookies: string; sessionId: string }>;
    end: (
      world: World,
      approver: { cookies: string; sessionId: string },
    ) => Promise<Response>;
  };
  const endings: Ending[] = [
    {
      name: "own revoke",
      async approver(world) {
        const cookies = await signIn(world.app, "target@example.com");
        return { cookies, sessionId: await sessionIdOf(cookies) };
      },
      end: (world, approver) =>
        world.app.request(`/api/user/sessions/${approver.sessionId}`, {
          method: "DELETE",
          headers: { cookie: world.target.cookies, origin },
        }),
    },
    {
      name: "admin revoke",
      approver: async (world) => ({
        cookies: world.target.cookies,
        sessionId: world.targetSessionId,
      }),
      end: (world, approver) =>
        world.asAdmin(
          `/${world.target.userId}/sessions/${approver.sessionId}`,
          { method: "DELETE" },
        ),
    },
    {
      name: "sign-out",
      approver: async (world) => ({
        cookies: world.target.cookies,
        sessionId: world.targetSessionId,
      }),
      end: (world, approver) =>
        post(world.app, "/api/auth/sign-out", approver.cookies),
    },
  ];

  for (const ending of endings) {
    it(`(a) ${ending.name} first: redemption returns null`, async () => {
      const world = await setup();
      const approver = await ending.approver(world);
      const code = await approveMcpAgent(world.app, {
        cookie: approver.cookies,
      });
      const lock = await holdRowLock("user", world.target.userId);
      const [ended, redeemed] = await releaseWhenQueued<Response>(lock, [
        { start: () => [ending.end(world, approver)], waiters: 1 },
        { start: () => [exchangeMcpCode(world.app, code)], waiters: 2 },
      ]);
      expect(ended.status).toBe(200);
      expect(redeemed.status).toBe(400);
      expect(await grantsOf(world.target.userId)).toEqual([]);
    });

    it(`(b) redemption first, then ${ending.name}: the grant survives`, async () => {
      const world = await setup();
      const approver = await ending.approver(world);
      const code = await approveMcpAgent(world.app, {
        cookie: approver.cookies,
      });
      const lock = await holdRowLock("user", world.target.userId);
      const [redeemed, ended] = await releaseWhenQueued<Response>(lock, [
        { start: () => [exchangeMcpCode(world.app, code)], waiters: 1 },
        { start: () => [ending.end(world, approver)], waiters: 2 },
      ]);
      expect(ended.status).toBe(200);
      const accessToken = await tokenOf(redeemed);
      expect(await identity.sessions.existing([approver.sessionId])).toEqual(
        new Set(),
      );
      // BOARD.md: signing out sessions does not end grants.
      expect(await restStatus(world.app, accessToken)).toBe(200);
      expect(await grantsOf(world.target.userId)).toEqual([
        { revokedAt: null },
      ]);
    });
  }

  it("(c) password changed first: redemption returns null", async () => {
    const world = await setup();
    const code = await approveMcpAgent(world.app, {
      cookie: world.target.cookies,
    });
    const changed = await post(
      world.app,
      "/api/auth/change-password",
      world.target.cookies,
      { currentPassword: PASSWORD, newPassword: "another-long-password" },
    );
    expect(changed.status).toBe(200);
    expect((await exchangeMcpCode(world.app, code)).status).toBe(400);
    expect(await grantsOf(world.target.userId)).toEqual([]);
  });

  it("(c) password reset first: redemption returns null", async () => {
    const world = await setup();
    const code = await approveMcpAgent(world.app, {
      cookie: world.target.cookies,
    });
    await resetPassword(world.app, world.target.userId);
    expect((await exchangeMcpCode(world.app, code)).status).toBe(400);
    expect(await grantsOf(world.target.userId)).toEqual([]);
  });

  async function redeemed(world: World): Promise<string> {
    const code: ApprovedMcpCode = await approveMcpAgent(world.app, {
      cookie: world.target.cookies,
    });
    return tokenOf(await exchangeMcpCode(world.app, code));
  }

  it.each([
    ["password reset", true],
    ["ban", true],
    ["deactivation", true],
    ["plain password change", false],
  ] as const)(
    "(d) redemption first, then %s: grant revoked = %s",
    async (change, revokes) => {
      const world = await setup();
      const accessToken = await redeemed(world);
      if (change === "password reset") {
        await resetPassword(world.app, world.target.userId);
      } else if (change === "ban") {
        const banned = await post(
          world.app,
          "/api/auth/admin/ban-user",
          world.admin.cookies,
          { userId: world.target.userId },
        );
        expect(banned.status).toBe(200);
      } else if (change === "deactivation") {
        const deactivated = await world.asAdmin(
          `/${world.target.userId}/deactivate`,
          { method: "POST" },
        );
        expect(deactivated.status).toBe(200);
      } else {
        const changed = await post(
          world.app,
          "/api/auth/change-password",
          world.target.cookies,
          { currentPassword: PASSWORD, newPassword: "another-long-password" },
        );
        expect(changed.status).toBe(200);
      }
      expect(await restStatus(world.app, accessToken)).toBe(
        revokes ? 401 : 200,
      );
      const [grant] = await grantsOf(world.target.userId);
      expect(grant?.revokedAt !== null).toBe(revokes);
    },
  );
});

describe("P2 A3: admin revocation commits with its audit row or not at all", () => {
  const revoked = async () =>
    (await readAuditLog()).filter((row) => row.action === "session.revoked");

  it("killed before commit: the session stays valid and no audit row exists", async () => {
    const world = await setup();
    failures.audit = true;
    const response = await world.asAdmin(
      `/${world.target.userId}/sessions/${world.targetSessionId}`,
      { method: "DELETE" },
    );
    expect(response.status).toBe(500);
    expect(await meStatus(world.app, world.target.cookies)).toBe(200);
    expect(await revoked()).toHaveLength(0);
  });

  it("killed after commit: the session is gone and one audit row exists", async () => {
    const world = await setup();
    failures.socketFanOut = true;
    const response = await world.asAdmin(
      `/${world.target.userId}/sessions/${world.targetSessionId}`,
      { method: "DELETE" },
    );
    expect(response.status).toBe(500);
    expect(await meStatus(world.app, world.target.cookies)).toBe(401);
    expect(await revoked()).toHaveLength(1);
  });
});

describe("P2 A4: retrying a revocation", () => {
  it("answers 404 to a repeated single revoke and writes no second audit row", async () => {
    const world = await setup();
    const path = `/${world.target.userId}/sessions/${world.targetSessionId}`;
    expect((await world.asAdmin(path, { method: "DELETE" })).status).toBe(200);
    expect((await world.asAdmin(path, { method: "DELETE" })).status).toBe(404);
    expect(
      (await readAuditLog()).filter((row) => row.action === "session.revoked"),
    ).toHaveLength(1);
  });

  it("answers revoked: 0 to a repeated revoke-all and writes no audit row for it", async () => {
    const world = await setup();
    const path = `/${world.target.userId}/sessions`;
    const first = await world.asAdmin(path, { method: "DELETE" });
    // Sign-up and sign-in each left a session.
    expect(await first.json()).toEqual({ revoked: 2 });
    const second = await world.asAdmin(path, { method: "DELETE" });
    expect(second.status).toBe(200);
    expect(await second.json()).toEqual({ revoked: 0 });
    expect(
      (await readAuditLog()).filter(
        (row) => row.action === "session.revoked_all",
      ),
    ).toHaveLength(1);
  });
});

describe("P2 A5: reactivation never revives what deactivation ended", () => {
  it("keeps the old cookie refused, the old socket closed and the old grants revoked", async () => {
    const world = await setup();
    await initializeWebSocketAdapter();
    const accessToken = await (async () => {
      const code = await approveMcpAgent(world.app, {
        cookie: world.target.cookies,
      });
      return tokenOf(await exchangeMcpCode(world.app, code));
    })();
    const socket = connectSocket(world.target.userId, world.targetSessionId);

    const userPath = `/${world.target.userId}`;
    expect(
      (await world.asAdmin(`${userPath}/deactivate`, { method: "POST" }))
        .status,
    ).toBe(200);
    expect(
      (await world.asAdmin(`${userPath}/reactivate`, { method: "POST" }))
        .status,
    ).toBe(200);

    expect(await meStatus(world.app, world.target.cookies)).toBe(401);
    expect(socket.close).toHaveBeenCalled();
    expect(await restStatus(world.app, accessToken)).toBe(401);
    expect((await grantsOf(world.target.userId))[0]?.revokedAt).not.toBeNull();
    // Reactivated: a fresh sign-in works again.
    const fresh = await signIn(world.app, "target@example.com");
    expect(await meStatus(world.app, fresh)).toBe(200);
  });
});

describe("P2 A6: a revoke closes that session's sockets only", () => {
  it("closes the revoked session's socket and leaves the user's other session open", async () => {
    const world = await setup();
    await initializeWebSocketAdapter();
    const otherCookies = await signIn(world.app, "target@example.com");
    const otherSessionId = await sessionIdOf(otherCookies);
    const revokedSocket = connectSocket(
      world.target.userId,
      world.targetSessionId,
    );
    const keptSocket = connectSocket(world.target.userId, otherSessionId);

    const response = await world.asAdmin(
      `/${world.target.userId}/sessions/${world.targetSessionId}`,
      { method: "DELETE" },
    );
    expect(response.status).toBe(200);
    expect(revokedSocket.close).toHaveBeenCalled();
    expect(keptSocket.close).not.toHaveBeenCalled();
    expect(await meStatus(world.app, otherCookies)).toBe(200);
  });

  it("closes the socket within one recheck interval when the fan-out fails", async () => {
    const world = await setup();
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    await initializeWebSocketAdapter();
    const otherSessionId = await sessionIdOf(
      await signIn(world.app, "target@example.com"),
    );
    const socket = connectSocket(world.target.userId, world.targetSessionId);
    const kept = connectSocket(world.target.userId, otherSessionId);
    failures.socketFanOut = true;

    const response = await world.asAdmin(
      `/${world.target.userId}/sessions/${world.targetSessionId}`,
      { method: "DELETE" },
    );
    expect(response.status).toBe(500);
    expect(socket.close).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(SESSION_RECHECK_MS);
    await vi.waitFor(() => expect(socket.close).toHaveBeenCalled());
    expect(kept.close).not.toHaveBeenCalled();
  });

  it("stops the recheck timer on shutdown", async () => {
    await initializeWebSocketAdapter();
    expect(isSessionRecheckRunning()).toBe(true);
    await shutdownWebSocketAdapter();
    expect(isSessionRecheckRunning()).toBe(false);
  });
});

describe("P2 A7: a banned user who still has a session row", () => {
  // Real sign-up cookies throughout (adminWithTarget), never the session mock.
  it("gets 401 on REST and no WebSocket upgrade", async () => {
    const world = await setup();
    await db
      .update(schema.userTable)
      .set({ banned: true })
      .where(eq(schema.userTable.id, world.target.userId));
    expect(await identity.sessions.existing([world.targetSessionId])).toEqual(
      new Set([world.targetSessionId]),
    );

    expect(await meStatus(world.app, world.target.cookies)).toBe(401);
    const upgrade = await world.app.request("/api/ws/user", {
      headers: {
        cookie: world.target.cookies,
        origin,
        upgrade: "websocket",
        connection: "Upgrade",
        "sec-websocket-version": "13",
        "sec-websocket-key": "dGhlIHNhbXBsZSBub25jZQ==",
      },
    });
    expect(upgrade.status).toBe(401);
  });
});

describe("P2 A7 on /api/auth: the provider's routes refuse a banned session", () => {
  async function banned() {
    const world = await setup();
    // The admin is the banned one, so the admin action is a real attempt.
    await db
      .update(schema.userTable)
      .set({ banned: true })
      .where(eq(schema.userTable.id, world.admin.userId));
    const call = (method: string, path: string, body?: unknown) =>
      world.app.request(`/api/auth${path}`, {
        method,
        headers: {
          cookie: world.admin.cookies,
          origin,
          ...(body === undefined ? {} : { "content-type": "application/json" }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    return { world, call };
  }

  it("refuses an organization read and write, an admin action and get-session", async () => {
    const { call } = await banned();
    for (const response of [
      await call("GET", "/organization/list"),
      await call("POST", "/organization/create", {
        name: "Banned team",
        slug: "banned-team",
      }),
      await call("GET", "/admin/list-users"),
      await call("GET", "/get-session"),
      await call("POST", "/change-password", {
        currentPassword: PASSWORD,
        newPassword: "another-long-password",
      }),
    ]) {
      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({ code: "BANNED_USER" });
    }
    expect(
      await db
        .select()
        .from(schema.workspaceTable)
        .where(eq(schema.workspaceTable.slug, "banned-team")),
    ).toEqual([]);
  });

  it("still lets the banned session sign out", async () => {
    const { world, call } = await banned();
    const sessionId = await sessionIdOf(world.admin.cookies);
    expect((await call("POST", "/sign-out", {})).status).toBe(200);
    expect(await identity.sessions.existing([sessionId])).toEqual(new Set());
  });

  it("leaves anonymous sign-in and other users' sessions alone", async () => {
    const { world } = await banned();
    const cookies = await signIn(world.app, "target@example.com");
    const session = await world.app.request("/api/auth/get-session", {
      headers: { cookie: cookies, origin },
    });
    expect(session.status).toBe(200);
    expect(await session.json()).toMatchObject({
      user: { email: "target@example.com" },
    });
  });
});

describe("P2 A6: the session recheck", () => {
  function spyOnExisting(existing: (ids: string[]) => Promise<Set<string>>) {
    const real = createBetterAuthIdentity(auth, batonIdentityHooks);
    const spy = vi.fn(existing);
    vi.spyOn(identityHolder, "current", "get").mockReturnValue({
      ...real,
      sessions: { ...real.sessions, existing: spy },
    });
    return spy;
  }

  it(`asks about at most ${SESSION_RECHECK_CHUNK} sessions per query`, async () => {
    const spy = spyOnExisting(async (ids) => new Set(ids));
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    await initializeWebSocketAdapter();
    const total = SESSION_RECHECK_CHUNK * 2 + 1;
    for (let n = 0; n < total; n += 1) connectSocket("chunked-user", `s-${n}`);

    await vi.advanceTimersByTimeAsync(SESSION_RECHECK_MS);
    await vi.waitFor(() => expect(spy).toHaveBeenCalledTimes(3));
    expect(spy.mock.calls.map(([ids]) => ids.length)).toEqual([
      SESSION_RECHECK_CHUNK,
      SESSION_RECHECK_CHUNK,
      1,
    ]);
    expect(new Set(spy.mock.calls.flatMap(([ids]) => ids)).size).toBe(total);
  });

  it("skips a tick while the previous recheck is still running", async () => {
    let finish!: () => void;
    const spy = spyOnExisting(
      (ids) =>
        new Promise((resolve) => {
          finish = () => resolve(new Set(ids));
        }),
    );
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    await initializeWebSocketAdapter();
    connectSocket("slow-user", "slow-session");

    await vi.advanceTimersByTimeAsync(SESSION_RECHECK_MS);
    await vi.waitFor(() => expect(spy).toHaveBeenCalledTimes(1));
    await vi.advanceTimersByTimeAsync(SESSION_RECHECK_MS * 3);
    expect(spy).toHaveBeenCalledTimes(1);

    finish();
    await vi.waitFor(async () => {
      await vi.advanceTimersByTimeAsync(SESSION_RECHECK_MS);
      expect(spy).toHaveBeenCalledTimes(2);
    });
    finish();
  });
});
