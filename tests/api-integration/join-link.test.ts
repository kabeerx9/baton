import { and, eq, isNull, sql } from "drizzle-orm";
import type { WSContext } from "hono/ws";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import {
  workspaceJoinLinkTable,
  workspaceMemberRemovalTable,
} from "../../apps/api/src/database/schema";
import { resetJoinLinkRateLimits } from "../../apps/api/src/join-link/rate-limit";
import {
  addConnection,
  addUserConnection,
  initializeWebSocketAdapter,
  removeConnection,
  removeUserConnection,
  shutdownWebSocketAdapter,
} from "../../apps/api/src/ws";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";
import {
  type JoinLinkBody,
  joinLinkFixture,
  linkRow,
  memberRows,
} from "./helpers/join-link";

beforeEach(async () => {
  await resetTestDatabase();
  resetJoinLinkRateLimits();
  vi.stubEnv("NOTIFICATION_SECRET_ENCRYPTION_KEY", "join-link-test-key");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

async function code(response: Response) {
  return ((await response.json()) as { code?: string }).code;
}

async function setLink(
  id: string,
  values: Partial<typeof workspaceJoinLinkTable.$inferInsert>,
) {
  await db
    .update(workspaceJoinLinkTable)
    .set(values)
    .where(eq(workspaceJoinLinkTable.id, id));
}

describe("join link state", () => {
  it("refuses an expired link with 410 JOIN_LINK_EXPIRED (1)", async () => {
    const ctx = await joinLinkFixture();
    const { link, token } = await ctx.createLink();
    await setLink(link.id, { expiresAt: new Date(Date.now() - 1000) });
    const response = await ctx.join(await ctx.person(), token);
    expect(response.status).toBe(410);
    expect(await code(response)).toBe("JOIN_LINK_EXPIRED");
  });

  it("refuses a revoked link with 410 JOIN_LINK_REVOKED (2)", async () => {
    const ctx = await joinLinkFixture();
    const { token } = await ctx.createLink();
    const revoked = await ctx.call(`/join-link/workspace/${ctx.workspace.id}`, {
      method: "DELETE",
      headers: { cookie: ctx.owner.cookies },
    });
    expect(revoked.status).toBe(200);
    expect(await revoked.json()).toEqual({ link: null });
    const again = await ctx.call(`/join-link/workspace/${ctx.workspace.id}`, {
      method: "DELETE",
      headers: { cookie: ctx.owner.cookies },
    });
    expect(again.status).toBe(200);

    const response = await ctx.join(await ctx.person(), token);
    expect(response.status).toBe(410);
    expect(await code(response)).toBe("JOIN_LINK_REVOKED");
  });

  it("refuses a used-up link and never counts past max_uses (3)", async () => {
    const ctx = await joinLinkFixture();
    const { link, token } = await ctx.createLink({ maxUses: 1 });
    expect((await ctx.join(await ctx.person(), token)).status).toBe(200);
    const response = await ctx.join(await ctx.person(), token);
    expect(response.status).toBe(410);
    expect(await code(response)).toBe("JOIN_LINK_USED_UP");
    expect((await linkRow(link.id))?.useCount).toBe(1);
  });

  it("joins as a member with access to every project and live events (16)", async () => {
    const ctx = await joinLinkFixture();
    const { project } = await createProjectFixture({
      workspaceId: ctx.workspace.id,
    });
    const { link, token } = await ctx.createLink();
    const joiner = await ctx.person();

    const ownerSocket = { send: vi.fn(), close: vi.fn() };
    const boardSocket = { send: vi.fn(), close: vi.fn() };
    const userConnection = addUserConnection(
      ctx.owner.userId,
      ownerSocket as unknown as WSContext,
    );
    // A member of an unrelated workspace must hear nothing.
    const { user: stranger } = await createWorkspaceMember();
    const strangerSocket = { send: vi.fn(), close: vi.fn() };
    const strangerConnection = addUserConnection(
      stranger.id,
      strangerSocket as unknown as WSContext,
    );
    const boardConnection = addConnection(
      project.id,
      boardSocket as unknown as WSContext,
      ctx.owner.userId,
      "window",
      ctx.workspace.id,
    );
    await initializeWebSocketAdapter();
    const sent = (socket: typeof ownerSocket) =>
      socket.send.mock.calls.map(([message]) => JSON.parse(message as string));
    try {
      const response = await ctx.join(joiner, token);
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        outcome: "joined",
        workspace: {
          id: ctx.workspace.id,
          slug: ctx.workspace.slug,
          name: "Join Team",
        },
      });
      await vi.waitFor(() => {
        expect(sent(ownerSocket)).toContainEqual({
          type: "WORKSPACE_MEMBERS_UPDATED",
          workspaceId: ctx.workspace.id,
        });
        expect(sent(boardSocket)).toContainEqual(
          expect.objectContaining({
            type: "PROJECT_MEMBERS_UPDATED",
            projectId: project.id,
          }),
        );
      });
      expect(sent(strangerSocket)).toEqual([]);
    } finally {
      removeUserConnection(stranger.id, strangerConnection);
      removeUserConnection(ctx.owner.userId, userConnection);
      removeConnection(project.id, boardConnection);
      await shutdownWebSocketAdapter();
    }

    expect(await memberRows(ctx.workspace.id, joiner.userId)).toEqual([
      expect.objectContaining({ role: "member" }),
    ]);
    // Mode "all" is the absence of an access row.
    expect(
      await db
        .select()
        .from(schema.workspaceMemberAccessTable)
        .where(eq(schema.workspaceMemberAccessTable.userId, joiner.userId)),
    ).toEqual([]);
    const read = await ctx.call(`/project/${project.id}`, {
      headers: { cookie: joiner.cookies },
    });
    expect(read.status).toBe(200);
    expect((await linkRow(link.id))?.useCount).toBe(1);
  });

  it("answers already_member without using the link or sending an event (6)", async () => {
    const ctx = await joinLinkFixture();
    const { link, token } = await ctx.createLink();
    const socket = { send: vi.fn(), close: vi.fn() };
    const connection = addUserConnection(
      ctx.owner.userId,
      socket as unknown as WSContext,
    );
    try {
      const response = await ctx.join(ctx.owner, token);
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({
        outcome: "already_member",
      });
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(socket.send).not.toHaveBeenCalled();
    } finally {
      removeUserConnection(ctx.owner.userId, connection);
    }
    expect((await linkRow(link.id))?.useCount).toBe(0);
    expect(await memberRows(ctx.workspace.id, ctx.owner.userId)).toHaveLength(
      1,
    );
  });
});

describe("removed members (4)", () => {
  it("refuses a link made before a Better Auth removal and admits with a newer link", async () => {
    const ctx = await joinLinkFixture();
    const { link, token } = await ctx.createLink();
    const joiner = await ctx.person("Removed Person");
    expect((await ctx.join(joiner, token)).status).toBe(200);

    const removed = await ctx.call("/auth/organization/remove-member", {
      method: "POST",
      body: {
        organizationId: ctx.workspace.id,
        memberIdOrEmail: "removed-person@example.com",
      },
      headers: { cookie: ctx.owner.cookies },
    });
    expect(removed.status).toBe(200);
    const [removal] = await db
      .select()
      .from(workspaceMemberRemovalTable)
      .where(eq(workspaceMemberRemovalTable.userId, joiner.userId));
    expect(removal?.workspaceId).toBe(ctx.workspace.id);

    const refused = await ctx.join(joiner, token);
    expect(refused.status).toBe(403);
    expect(await refused.json()).toMatchObject({
      code: "REMOVED_FROM_WORKSPACE",
      message:
        "You were removed from this workspace. Ask an admin for a new link.",
    });
    expect(await memberRows(ctx.workspace.id, joiner.userId)).toEqual([]);
    expect((await linkRow(link.id))?.useCount).toBe(1);

    const fresh = await ctx.createLink();
    const admitted = await ctx.join(joiner, fresh.token);
    expect(admitted.status).toBe(200);
    expect(await admitted.json()).toMatchObject({ outcome: "joined" });
  });

  it("records a removal by an instance admin, which the old link then refuses", async () => {
    const ctx = await joinLinkFixture();
    const { token } = await ctx.createLink();
    const joiner = await ctx.person("Admin Removed");
    expect((await ctx.join(joiner, token)).status).toBe(200);
    const instanceAdmin = await ctx.person("Instance Admin", "admin");

    const removed = await ctx.call(
      `/admin/workspaces/${ctx.workspace.id}/members/${joiner.userId}`,
      { method: "DELETE", headers: { cookie: instanceAdmin.cookies } },
    );
    expect(removed.status).toBe(200);
    expect(
      await db
        .select()
        .from(workspaceMemberRemovalTable)
        .where(eq(workspaceMemberRemovalTable.userId, joiner.userId)),
    ).toHaveLength(1);

    const refused = await ctx.join(joiner, token);
    expect(refused.status).toBe(403);
    expect(await code(refused)).toBe("REMOVED_FROM_WORKSPACE");
  });

  it("fails both removals when the removal cannot be recorded", async () => {
    const ctx = await joinLinkFixture();
    const { token } = await ctx.createLink();
    const joiner = await ctx.person("Kept Person");
    expect((await ctx.join(joiner, token)).status).toBe(200);
    const instanceAdmin = await ctx.person("Instance Admin", "admin");

    await db.execute(sql`
      CREATE FUNCTION refuse_removal() RETURNS trigger LANGUAGE plpgsql AS
        $$ BEGIN RAISE EXCEPTION 'removal record refused'; END $$;
      CREATE TRIGGER refuse_removal BEFORE INSERT OR UPDATE
        ON workspace_member_removal FOR EACH ROW EXECUTE FUNCTION refuse_removal();
    `);
    try {
      const native = await ctx.call("/auth/organization/remove-member", {
        method: "POST",
        body: {
          organizationId: ctx.workspace.id,
          memberIdOrEmail: "kept-person@example.com",
        },
        headers: { cookie: ctx.owner.cookies },
      });
      expect(native.status).toBeGreaterThanOrEqual(400);
      const admin = await ctx.call(
        `/admin/workspaces/${ctx.workspace.id}/members/${joiner.userId}`,
        { method: "DELETE", headers: { cookie: instanceAdmin.cookies } },
      );
      expect(admin.status).toBeGreaterThanOrEqual(400);
    } finally {
      await db.execute(sql`
        DROP TRIGGER refuse_removal ON workspace_member_removal;
        DROP FUNCTION refuse_removal();
      `);
    }
    expect(await memberRows(ctx.workspace.id, joiner.userId)).toHaveLength(1);
  });

  it("lets a person who left by themselves rejoin with the same link", async () => {
    const ctx = await joinLinkFixture();
    const { token } = await ctx.createLink();
    const joiner = await ctx.person();
    expect((await ctx.join(joiner, token)).status).toBe(200);

    const left = await ctx.call("/auth/organization/leave", {
      method: "POST",
      body: { organizationId: ctx.workspace.id },
      headers: { cookie: joiner.cookies },
    });
    expect(left.status).toBe(200);
    expect(await memberRows(ctx.workspace.id, joiner.userId)).toEqual([]);

    const rejoined = await ctx.join(joiner, token);
    expect(rejoined.status).toBe(200);
    expect(await rejoined.json()).toMatchObject({ outcome: "joined" });
  });
});

describe("a removal marker means the last exit was a removal", () => {
  async function refuseMemberDeletes() {
    await db.execute(sql`
      CREATE FUNCTION refuse_member_delete() RETURNS trigger LANGUAGE plpgsql AS
        $$ BEGIN RAISE EXCEPTION 'member delete refused'; END $$;
      CREATE TRIGGER refuse_member_delete BEFORE DELETE
        ON workspace_member FOR EACH ROW EXECUTE FUNCTION refuse_member_delete();
    `);
    return async () => {
      await db.execute(sql`
        DROP TRIGGER IF EXISTS refuse_member_delete ON workspace_member;
        DROP FUNCTION IF EXISTS refuse_member_delete();
      `);
    };
  }

  async function setup() {
    const ctx = await joinLinkFixture();
    const { token } = await ctx.createLink();
    const joiner = await ctx.person("Marked Person");
    expect((await ctx.join(joiner, token)).status).toBe(200);
    const remove = () =>
      ctx.call("/auth/organization/remove-member", {
        method: "POST",
        body: {
          organizationId: ctx.workspace.id,
          memberIdOrEmail: "marked-person@example.com",
        },
        headers: { cookie: ctx.owner.cookies },
      });
    const markers = () =>
      db
        .select()
        .from(workspaceMemberRemovalTable)
        .where(eq(workspaceMemberRemovalTable.userId, joiner.userId));
    return { ctx, token, joiner, remove, markers };
  }

  it("clears a stale marker from a failed removal when the person leaves", async () => {
    const { ctx, token, joiner, remove, markers } = await setup();
    const allowDeletes = await refuseMemberDeletes();
    try {
      expect((await remove()).status).toBeGreaterThanOrEqual(400);
    } finally {
      await allowDeletes();
    }
    expect(await memberRows(ctx.workspace.id, joiner.userId)).toHaveLength(1);
    expect(await markers()).toHaveLength(1);

    const left = await ctx.call("/auth/organization/leave", {
      method: "POST",
      body: { organizationId: ctx.workspace.id },
      headers: { cookie: joiner.cookies },
    });
    expect(left.status).toBe(200);
    expect(await markers()).toEqual([]);

    const rejoined = await ctx.join(joiner, token);
    expect(rejoined.status).toBe(200);
    expect(await rejoined.json()).toMatchObject({ outcome: "joined" });
  });

  it("keeps refusing the old link after a removal that failed, then succeeded", async () => {
    const { ctx, token, joiner, remove } = await setup();
    const allowDeletes = await refuseMemberDeletes();
    try {
      expect((await remove()).status).toBeGreaterThanOrEqual(400);
    } finally {
      await allowDeletes();
    }
    expect((await remove()).status).toBe(200);
    const refused = await ctx.join(joiner, token);
    expect(refused.status).toBe(403);
    expect(await code(refused)).toBe("REMOVED_FROM_WORKSPACE");
  });

  it("keeps refusing the old link after one successful removal", async () => {
    const { ctx, token, joiner, remove, markers } = await setup();
    expect((await remove()).status).toBe(200);
    expect(await markers()).toHaveLength(1);
    const refused = await ctx.join(joiner, token);
    expect(refused.status).toBe(403);
    expect(await code(refused)).toBe("REMOVED_FROM_WORKSPACE");
  });
});

describe("archived workspaces (5)", () => {
  it("hides the link while archived and admits again after restore", async () => {
    const ctx = await joinLinkFixture();
    const { token } = await ctx.createLink();
    const instanceAdmin = await ctx.person("Instance Admin", "admin");
    const adminCall = (action: string) =>
      ctx.call(`/admin/workspaces/${ctx.workspace.id}/${action}`, {
        method: "POST",
        headers: { cookie: instanceAdmin.cookies },
      });
    expect((await adminCall("archive")).status).toBe(200);

    const joiner = await ctx.person();
    const refused = await ctx.join(joiner, token);
    expect(refused.status).toBe(404);
    expect(await code(refused)).toBe("JOIN_LINK_NOT_FOUND");
    expect(await (await ctx.preview(token)).json()).toEqual({
      status: "unavailable",
      reason: "not_found",
    });

    expect((await adminCall("restore")).status).toBe(200);
    expect((await (await ctx.preview(token)).json()) as object).toMatchObject({
      status: "active",
    });
    expect((await ctx.join(joiner, token)).status).toBe(200);
  });
});

describe("request shape", () => {
  it("refuses a role in the create or join body and stores member (9)", async () => {
    const ctx = await joinLinkFixture();
    const created = await ctx.call(`/join-link/workspace/${ctx.workspace.id}`, {
      method: "POST",
      body: { role: "owner" },
      headers: { cookie: ctx.owner.cookies },
    });
    expect(created.status).toBe(400);

    const { link, token } = await ctx.createLink();
    expect((await linkRow(link.id))?.role).toBe("member");
    const joiner = await ctx.person();
    const join = await ctx.call("/join-link/join", {
      method: "POST",
      body: { token, role: "owner" },
      headers: { cookie: joiner.cookies },
    });
    expect(join.status).toBe(400);
    expect(await memberRows(ctx.workspace.id, joiner.userId)).toEqual([]);
  });

  it("answers a malformed or unknown token with 404 JOIN_LINK_NOT_FOUND", async () => {
    const ctx = await joinLinkFixture();
    const joiner = await ctx.person();
    for (const token of ["short", "a".repeat(43)]) {
      const response = await ctx.join(joiner, token);
      expect(response.status).toBe(404);
      expect(await code(response)).toBe("JOIN_LINK_NOT_FOUND");
    }
  });

  it("refuses an out-of-range maxUses", async () => {
    const ctx = await joinLinkFixture();
    for (const maxUses of [0, 10_001, 1.5]) {
      const response = await ctx.call(
        `/join-link/workspace/${ctx.workspace.id}`,
        {
          method: "POST",
          body: { maxUses },
          headers: { cookie: ctx.owner.cookies },
        },
      );
      expect(response.status).toBe(400);
    }
  });
});

describe("preview (10)", () => {
  it("shows the workspace and sharer only while active", async () => {
    const ctx = await joinLinkFixture();
    const { link, token } = await ctx.createLink({ expiresIn: "30m" });
    const active = await ctx.preview(token);
    expect(active.status).toBe(200);
    expect(active.headers.get("cache-control")).toBe("no-store");
    expect(await active.json()).toEqual({
      status: "active",
      workspace: { name: "Join Team" },
      sharedBy: { name: "Owner Person" },
      expiresAt: link.expiresAt,
    });

    await setLink(link.id, { maxUses: 1, useCount: 1 });
    expect(await (await ctx.preview(token)).json()).toEqual({
      status: "unavailable",
      reason: "used_up",
    });
    await setLink(link.id, { expiresAt: new Date(Date.now() - 1000) });
    expect(await (await ctx.preview(token)).json()).toEqual({
      status: "unavailable",
      reason: "expired",
    });
    await setLink(link.id, { revokedAt: new Date() });
    expect(await (await ctx.preview(token)).json()).toEqual({
      status: "unavailable",
      reason: "revoked",
    });
    for (const unknown of ["a".repeat(43), "not a token", ""]) {
      expect(await (await ctx.preview(unknown)).json()).toEqual({
        status: "unavailable",
        reason: "not_found",
      });
    }
  });
});

describe("management access (11, 12, 14)", () => {
  it("lets owner and admin manage links and refuses member and viewer", async () => {
    const ctx = await joinLinkFixture();
    const routes = ["GET", "POST", "DELETE"] as const;
    const send = (method: string, cookies: string) =>
      ctx.call(`/join-link/workspace/${ctx.workspace.id}`, {
        method,
        body: method === "POST" ? {} : undefined,
        headers: { cookie: cookies },
      });

    for (const role of ["member", "viewer"]) {
      const who = await ctx.person(`Role ${role}`);
      await ctx.addMember(who, role);
      for (const method of routes) {
        const response = await send(method, who.cookies);
        expect([role, method, response.status]).toEqual([role, method, 403]);
        expect(await code(response)).toBe("MISSING_PERMISSION");
      }
    }
    const admin = await ctx.person("Role admin");
    await ctx.addMember(admin, "admin");
    for (const who of [admin, ctx.owner]) {
      expect((await send("GET", who.cookies)).status).toBe(200);
      expect((await send("POST", who.cookies)).status).toBe(201);
      expect((await send("DELETE", who.cookies)).status).toBe(200);
    }

    const outsider = await ctx.person("Outsider");
    expect((await send("GET", outsider.cookies)).status).toBe(404);
  });

  it("refuses API keys and MCP tokens on every authenticated route", async () => {
    const ctx = await joinLinkFixture();
    const { token } = await ctx.createLink();
    const { auth } = await import("../../apps/api/src/auth");
    const { connectMcpAgent } = await import("./helpers/mcp-oauth");
    const { key } = await auth.api.createApiKey({
      body: { userId: ctx.owner.userId, name: "Join links" },
    });
    const agent = await connectMcpAgent(ctx.app, { cookie: ctx.owner.cookies });

    for (const headers of [
      { "x-api-key": key },
      { authorization: `Bearer ${agent.accessToken}` },
    ]) {
      for (const [method, path, body] of [
        ["GET", `/join-link/workspace/${ctx.workspace.id}`, undefined],
        ["POST", `/join-link/workspace/${ctx.workspace.id}`, {}],
        ["DELETE", `/join-link/workspace/${ctx.workspace.id}`, undefined],
        ["POST", "/join-link/join", { token }],
      ] as const) {
        const response = await ctx.call(path, { method, body, headers });
        expect([method, path, response.status]).toEqual([method, path, 403]);
        expect(await code(response)).toBe("SESSION_REQUIRED");
      }
    }
  });

  it("refuses to create a link for a demo workspace", async () => {
    const ctx = await joinLinkFixture();
    const started = await ctx.call("/tour/start", {
      method: "POST",
      headers: { cookie: ctx.owner.cookies },
    });
    expect(started.status).toBe(200);
    const { demoWorkspace } = (await started.json()) as {
      demoWorkspace: { id: string };
    };
    const response = await ctx.call(
      `/join-link/workspace/${demoWorkspace.id}`,
      {
        method: "POST",
        body: {},
        headers: { cookie: ctx.owner.cookies },
      },
    );
    expect(response.status).toBe(403);
    expect(await code(response)).toBe("DEMO_WORKSPACE");
  });
});

describe("one link per workspace (13)", () => {
  it("revokes the previous link on create", async () => {
    const ctx = await joinLinkFixture();
    const first = await ctx.createLink();
    const second = await ctx.createLink({ expiresIn: "7d", maxUses: 3 });
    expect(second.link).toMatchObject({
      state: "active",
      maxUses: 3,
      useCount: 0,
      createdBy: { id: ctx.owner.userId, name: "Owner Person" },
    });

    const refused = await ctx.join(await ctx.person(), first.token);
    expect(refused.status).toBe(410);
    expect(await code(refused)).toBe("JOIN_LINK_REVOKED");

    const open = await db
      .select()
      .from(workspaceJoinLinkTable)
      .where(
        and(
          eq(workspaceJoinLinkTable.workspaceId, ctx.workspace.id),
          isNull(workspaceJoinLinkTable.revokedAt),
        ),
      );
    expect(open.map((row) => row.id)).toEqual([second.link.id]);
    const old = await linkRow(first.link.id);
    expect(old?.revokedBy).toBe(ctx.owner.userId);
    expect(old?.tokenCiphertext).toBeNull();
  });

  it("shows the current link again, and an expired one without a url", async () => {
    const ctx = await joinLinkFixture();
    const read = async () =>
      (await (
        await ctx.call(`/join-link/workspace/${ctx.workspace.id}`, {
          headers: { cookie: ctx.owner.cookies },
        })
      ).json()) as JoinLinkBody;
    expect(await read()).toEqual({ link: null });

    const { link } = await ctx.createLink();
    expect((await read()).link).toEqual(link);

    await setLink(link.id, { expiresAt: new Date(Date.now() - 1000) });
    expect((await read()).link).toMatchObject({ state: "expired", url: null });
  });
});

describe("limits", () => {
  it("refuses a join at 100 members with 409 (15)", async () => {
    const ctx = await joinLinkFixture();
    const { token } = await ctx.createLink();
    const filler = Array.from({ length: 99 }, (_, index) => ({
      id: `filler-${index}`,
      name: `Filler ${index}`,
      email: `filler-${index}@example.com`,
    }));
    await db.insert(schema.userTable).values(filler);
    await db.insert(schema.workspaceUserTable).values(
      filler.map((user) => ({
        workspaceId: ctx.workspace.id,
        userId: user.id,
        role: "member",
        joinedAt: new Date(),
      })),
    );
    const response = await ctx.join(await ctx.person(), token);
    expect(response.status).toBe(409);
    expect(await code(response)).toBe("WORKSPACE_MEMBER_LIMIT_REACHED");
  });

  it("limits joins per user and previews per address with Retry-After (18)", async () => {
    const ctx = await joinLinkFixture();
    const joiner = await ctx.person();
    for (let attempt = 0; attempt < 10; attempt += 1)
      expect((await ctx.join(joiner, "bad")).status).toBe(404);
    const limited = await ctx.join(joiner, "bad");
    expect(limited.status).toBe(429);
    expect(await code(limited)).toBe("RATE_LIMITED");
    expect(Number(limited.headers.get("retry-after"))).toBeGreaterThan(0);

    for (let attempt = 0; attempt < 30; attempt += 1)
      expect((await ctx.preview("bad")).status).toBe(200);
    const previewLimited = await ctx.preview("bad");
    expect(previewLimited.status).toBe(429);
    expect(await code(previewLimited)).toBe("RATE_LIMITED");
    expect(Number(previewLimited.headers.get("retry-after"))).toBeGreaterThan(
      0,
    );
  });

  it("refuses a 21st link in an hour with 429", async () => {
    const ctx = await joinLinkFixture();
    await db.insert(workspaceJoinLinkTable).values(
      Array.from({ length: 20 }, (_, index) => ({
        workspaceId: ctx.workspace.id,
        tokenHash: `hash-${index}`,
        expiresAt: new Date(Date.now() + 60_000),
        revokedAt: new Date(),
      })),
    );
    const response = await ctx.call(
      `/join-link/workspace/${ctx.workspace.id}`,
      {
        method: "POST",
        body: {},
        headers: { cookie: ctx.owner.cookies },
      },
    );
    expect(response.status).toBe(429);
    expect(await code(response)).toBe("RATE_LIMITED");
    expect(Number(response.headers.get("retry-after"))).toBeGreaterThan(0);
  });
});

describe("without the encryption key (17)", () => {
  it("returns url on create and null on read", async () => {
    vi.stubEnv("NOTIFICATION_SECRET_ENCRYPTION_KEY", "");
    const ctx = await joinLinkFixture();
    const { link } = await ctx.createLink();
    expect(link.url).toMatch(/\/join\/[A-Za-z0-9_-]{43}$/);
    expect((await linkRow(link.id))?.tokenCiphertext).toBeNull();
    const read = await ctx.call(`/join-link/workspace/${ctx.workspace.id}`, {
      headers: { cookie: ctx.owner.cookies },
    });
    expect(((await read.json()) as JoinLinkBody).link).toMatchObject({
      id: link.id,
      state: "active",
      url: null,
    });
  });

  it("shows no url when the key changed since the link was made", async () => {
    const ctx = await joinLinkFixture();
    const { link } = await ctx.createLink();
    vi.stubEnv("NOTIFICATION_SECRET_ENCRYPTION_KEY", "a-different-key");
    const read = await ctx.call(`/join-link/workspace/${ctx.workspace.id}`, {
      headers: { cookie: ctx.owner.cookies },
    });
    expect(read.status).toBe(200);
    expect(((await read.json()) as JoinLinkBody).link).toMatchObject({
      id: link.id,
      url: null,
    });
  });

  it("never stores the raw token", async () => {
    const ctx = await joinLinkFixture();
    const { link, token } = await ctx.createLink();
    const row = await linkRow(link.id);
    expect(JSON.stringify(row)).not.toContain(token);
  });
});

describe("create defaults", () => {
  it("creates a 24-hour link with no limit from an empty request", async () => {
    const ctx = await joinLinkFixture();
    const response = await ctx.app.request(
      `/api/join-link/workspace/${ctx.workspace.id}`,
      {
        method: "POST",
        headers: { cookie: ctx.owner.cookies, origin: "http://localhost:5173" },
      },
    );
    expect(response.status).toBe(201);
    const { link } = (await response.json()) as JoinLinkBody;
    expect(link).toMatchObject({ state: "active", maxUses: null });
    const hours =
      (Date.parse(link!.expiresAt) - Date.parse(link!.createdAt)) / 3_600_000;
    expect(hours).toBeGreaterThan(23.9);
    expect(hours).toBeLessThan(24.1);
  });
});

describe("email invitations are removed (20)", () => {
  it("answers invite-member and accept-invitation with 410", async () => {
    const ctx = await joinLinkFixture();
    for (const [operation, body] of [
      [
        "invite-member",
        {
          organizationId: ctx.workspace.id,
          email: "friend@example.com",
          role: "member",
        },
      ],
      ["accept-invitation", { invitationId: "anything" }],
    ] as const) {
      const response = await ctx.call(`/auth/organization/${operation}`, {
        method: "POST",
        body,
        headers: { cookie: ctx.owner.cookies },
      });
      expect([operation, response.status]).toEqual([operation, 410]);
      expect(await code(response)).toBe("INVITATIONS_REMOVED");
    }
    // A trailing slash must not reach Better Auth as a working invite.
    const slashed = await ctx.call("/auth/organization/invite-member/", {
      method: "POST",
      body: {
        organizationId: ctx.workspace.id,
        email: "friend@example.com",
        role: "member",
      },
      headers: { cookie: ctx.owner.cookies },
    });
    expect(slashed.status).not.toBe(200);
    expect(await db.select().from(schema.invitationTable)).toEqual([]);
  });
});
