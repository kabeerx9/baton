import { and, eq } from "drizzle-orm";
import type { WSContext } from "hono/ws";
import { Client } from "pg";
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
  workspaceMemberAccessTable,
  workspaceMemberRemovalTable,
} from "../../apps/api/src/database/schema";
import { addConnection, removeConnection } from "../../apps/api/src/ws";
import { resetTestDatabase } from "./helpers/database";
import { waitForLockWaiters } from "./helpers/row-lock";
import {
  ACTIONS,
  type Seeded,
  type WritesFixture,
  snapshot,
  watchEvents,
  writesFixture,
} from "./helpers/workspace-writes";

let ctx: WritesFixture;

beforeEach(async () => {
  await resetTestDatabase();
  ctx = await writesFixture();
});

const code = async (response: Response) =>
  ((await response.json()) as { code?: string }).code;

let created = 0;
async function create(name: unknown, headers = ctx.as.cookie("member")) {
  const response = await ctx.call(
    { method: "POST", path: "/workspace", body: { name } },
    headers,
  );
  if (response.status === 201) created++;
  return response;
}

// workspace.created writes the owner's notification after the response;
// let it land before the next reset truncates the tables.
afterEach(async () => {
  await vi.waitFor(async () => {
    const rows = await db
      .select({ id: schema.notificationTable.id })
      .from(schema.notificationTable)
      .where(eq(schema.notificationTable.type, "workspace_created"));
    expect(rows.length).toBeGreaterThanOrEqual(created);
  });
  created = 0;
});

const workspaceCount = async () =>
  (
    await db
      .select({ id: schema.workspaceTable.id })
      .from(schema.workspaceTable)
  ).length;

describe("demo workspaces (A6, A14)", () => {
  it("lets the owner update and delete a demo, and refuses leave with 409", async () => {
    let s = await ctx.seed("owner", { kind: "demo" });
    const updated = await ctx.cell(
      ACTIONS["workspace.update"]!(s),
      ctx.as.cookie("owner"),
    );
    expect(updated.status).toBe(200);
    const left = await ctx.cell(
      ACTIONS["workspace.leave"]!(s),
      ctx.as.cookie("owner"),
    );
    expect(left).toEqual({ status: 409, code: "ONLY_OWNER" });
    s = await ctx.seed("owner", { kind: "demo" });
    const deleted = await ctx.call(
      ACTIONS["workspace.delete"]!(s),
      ctx.as.cookie("owner"),
    );
    expect(deleted.status).toBe(200);
    expect(await deleted.json()).toEqual({ id: s.workspaceId });
  });

  it("refuses member, owner and role writes with DEMO_WORKSPACE", async () => {
    for (const action of [
      "member.remove",
      "member.role",
      "roles.create",
      "roles.update",
      "roles.update-seeded",
      "roles.delete",
    ]) {
      const s = await ctx.seed("owner", { kind: "demo" });
      const before = await snapshot(s.workspaceId);
      expect([
        action,
        await ctx.cell(ACTIONS[action]!(s), ctx.as.cookie("owner")),
      ]).toEqual([action, { status: 403, code: "DEMO_WORKSPACE" }]);
      expect(await snapshot(s.workspaceId)).toEqual(before);
    }
    const s = await ctx.seed("owner", { kind: "demo" });
    const transferred = await ctx.cell(
      {
        method: "PUT",
        path: `/workspace/${s.workspaceId}/owner`,
        body: { userId: s.userIds.target },
      },
      ctx.as.cookie("owner"),
    );
    expect(transferred).toEqual({ status: 403, code: "DEMO_WORKSPACE" });
  });

  it("answers an instance admin 404 on /api/admin for a demo", async () => {
    const s = await ctx.seed("owner", { kind: "demo" });
    const before = await snapshot(s.workspaceId);
    const id = s.workspaceId;
    for (const request of [
      { method: "GET", path: `/admin/workspaces/${id}/members` },
      {
        method: "DELETE",
        path: `/admin/workspaces/${id}/members/${s.userIds.target}`,
      },
      {
        method: "PUT",
        path: `/admin/workspaces/${id}/members/${s.userIds.target}/role`,
        body: { role: "viewer" },
      },
      {
        method: "PUT",
        path: `/admin/workspaces/${id}/owner`,
        body: { userId: s.userIds.target },
      },
      { method: "POST", path: `/admin/workspaces/${id}/archive` },
      { method: "DELETE", path: `/admin/workspaces/${id}` },
    ] as const) {
      const response = await ctx.call(request, ctx.as.cookie("instanceAdmin"));
      expect([request.method, request.path, response.status]).toEqual([
        request.method,
        request.path,
        404,
      ]);
    }
    expect(await snapshot(s.workspaceId)).toEqual(before);
  });
});

describe("removal and leave (A7)", () => {
  it("records the removal, clears project access and closes the member's sockets", async () => {
    const s = await ctx.seed("owner");
    const target = s.userIds.target!;
    await db.insert(workspaceMemberAccessTable).values({
      workspaceId: s.workspaceId,
      userId: target,
      projectAccess: "selected",
    });
    const ws = { send: vi.fn(), close: vi.fn() };
    const conn = addConnection(
      "project",
      ws as unknown as WSContext,
      target,
      "window",
      s.workspaceId,
    );
    const events = await watchEvents();
    try {
      const response = await ctx.call(
        ACTIONS["member.remove"]!(s),
        ctx.as.cookie("owner"),
      );
      expect(response.status).toBe(200);
      const members = (await response.json()) as Array<{ id: string }>;
      expect(members.map((row) => row.id)).not.toContain(target);
      expect(ws.close).toHaveBeenCalledWith(1008, "Workspace access revoked");
    } finally {
      removeConnection("project", conn);
    }
    const after = await snapshot(s.workspaceId);
    expect(after.removals).toEqual([{ userId: target }]);
    expect(after.access).toEqual([]);
    expect(events.types()).toContain("project_members.updated");
  });

  it("clears an earlier removal record when the person leaves", async () => {
    const s = await ctx.seed("member");
    await db.insert(workspaceMemberRemovalTable).values({
      workspaceId: s.workspaceId,
      userId: ctx.people.member.userId,
    });
    const response = await ctx.call(
      ACTIONS["workspace.leave"]!(s),
      ctx.as.cookie("member"),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ workspaceId: s.workspaceId });
    expect((await snapshot(s.workspaceId)).removals).toEqual([]);
  });
});

describe("creation (A8, A15)", () => {
  it("seeds viewer, member and admin with the caller as owner", async () => {
    const events = await watchEvents();
    const response = await create("New team");
    expect(response.status).toBe(201);
    const workspace = (await response.json()) as {
      id: string;
      slug: string;
      role: string;
    };
    expect(workspace).toMatchObject({ role: "owner", slug: "new-team" });
    const roles = await db
      .select({ role: schema.workspaceRoleTable.role })
      .from(schema.workspaceRoleTable)
      .where(eq(schema.workspaceRoleTable.workspaceId, workspace.id));
    expect(roles.map((row) => row.role).sort()).toEqual([
      "admin",
      "member",
      "viewer",
    ]);
    const [owner] = await db
      .select({ role: schema.workspaceUserTable.role })
      .from(schema.workspaceUserTable)
      .where(
        and(
          eq(schema.workspaceUserTable.workspaceId, workspace.id),
          eq(schema.workspaceUserTable.userId, ctx.people.member.userId),
        ),
      );
    expect(owner?.role).toBe("owner");
    expect(events.types()).toContain("workspace.created");
  });

  it("gives two workspaces with one name different slugs", async () => {
    const first = (await (await create("Same Name")).json()) as {
      slug: string;
    };
    const second = (await (await create("Same Name")).json()) as {
      slug: string;
    };
    expect(first.slug).toBe("same-name");
    expect(second.slug).toMatch(/^same-name-[a-z0-9]{6}$/);
  });

  it("refuses a bad name with nothing written", async () => {
    for (const name of ["", "   ", "x".repeat(300), 42]) {
      const response = await create(name);
      expect([name, response.status]).toEqual([name, 400]);
    }
    expect(await workspaceCount()).toBe(0);
  });

  it("refuses a banned user, an MCP token, a narrow key and a restricted non-admin", async () => {
    const token = await ctx.mcpTokenFor("member");
    const narrow = (await ctx.keyFor("member", { workspace: ["read"] })).key;
    await db
      .update(schema.userTable)
      .set({ banned: true })
      .where(eq(schema.userTable.id, ctx.people.viewer.userId));
    // The fence refuses a banned session before the route (401).
    expect([401, 403]).toContain(
      (await create("Banned", ctx.as.cookie("viewer"))).status,
    );
    const refusals = [
      await create("Agent", ctx.as.bearer(token)),
      await create("Narrow", ctx.as.key(narrow)),
    ];
    await db
      .insert(schema.instanceSettingsTable)
      .values({ id: "instance", workspaceCreationRestricted: true })
      .onConflictDoUpdate({
        target: schema.instanceSettingsTable.id,
        set: { workspaceCreationRestricted: true },
      });
    const restricted = await create("Restricted");
    expect(await code(restricted.clone())).toBe(
      "WORKSPACE_CREATION_RESTRICTED",
    );
    refusals.push(restricted);
    for (const response of refusals) expect(response.status).toBe(403);
    expect(await workspaceCount()).toBe(0);
    // An instance admin still may.
    expect(
      (await create("Admin's", ctx.as.cookie("instanceAdmin"))).status,
    ).toBe(201);
  });

  it("honours a restriction that commits while the create waits", async () => {
    await db
      .insert(schema.instanceSettingsTable)
      .values({ id: "instance", workspaceCreationRestricted: false })
      .onConflictDoUpdate({
        target: schema.instanceSettingsTable.id,
        set: { workspaceCreationRestricted: false },
      });
    const admin = new Client({ connectionString: process.env.DATABASE_URL });
    await admin.connect();
    let pending: Promise<Response> | undefined;
    try {
      await admin.query("BEGIN");
      await admin.query(
        "UPDATE instance_settings SET workspace_creation_restricted = true WHERE id = 'instance'",
      );
      pending = create("Racing");
      await waitForLockWaiters(1);
      await admin.query("COMMIT");
    } finally {
      await admin.end();
    }
    const response = await pending!;
    expect(response.status).toBe(403);
    expect(await code(response)).toBe("WORKSPACE_CREATION_RESTRICTED");
    expect(await workspaceCount()).toBe(0);
  });
});

describe("roles (A9)", () => {
  const roles = (s: Seeded) => `/workspace/${s.workspaceId}/roles`;

  it("lists roles with parsed permissions", async () => {
    const s = await ctx.seed("viewer");
    const response = await ctx.call(
      ACTIONS["roles.list"]!(s),
      ctx.as.cookie("viewer"),
    );
    expect(response.status).toBe(200);
    const list = (await response.json()) as Array<{
      role: string;
      permission: unknown;
    }>;
    expect(list.find((row) => row.role === "spare")).toMatchObject({
      permission: { task: ["read"] },
    });
  });

  it("caps a workspace at 25 roles", async () => {
    const s = await ctx.seed("owner");
    // The seed has five roles.
    for (let index = 0; index < 20; index++) {
      const response = await ctx.call(
        {
          method: "POST",
          path: roles(s),
          body: { role: `extra-${index}`, permission: { task: ["read"] } },
        },
        ctx.as.cookie("owner"),
      );
      expect(response.status).toBe(201);
    }
    const over = await ctx.cell(
      {
        method: "POST",
        path: roles(s),
        body: { role: "one-too-many", permission: { task: ["read"] } },
      },
      ctx.as.cookie("owner"),
    );
    expect(over).toEqual({ status: 400, code: "TOO_MANY_ROLES" });
  });

  it("refuses reserved names on create and rename", async () => {
    const s = await ctx.seed("owner");
    for (const name of ["owner", "viewer", "member", "admin", " Admin "]) {
      expect(
        await ctx.cell(
          {
            method: "POST",
            path: roles(s),
            body: { role: name, permission: { task: ["read"] } },
          },
          ctx.as.cookie("owner"),
        ),
      ).toEqual({ status: 400, code: "ROLE_NAME_RESERVED" });
      expect(
        await ctx.cell(
          {
            method: "PATCH",
            path: `${roles(s)}/${s.roleIds.spare}`,
            body: { role: name },
          },
          ctx.as.cookie("owner"),
        ),
      ).toEqual({ status: 400, code: "ROLE_NAME_RESERVED" });
    }
  });

  it("refuses an unknown resource or action with 400", async () => {
    const s = await ctx.seed("owner");
    for (const permission of [{ spaceship: ["read"] }, { task: ["launch"] }]) {
      expect(
        await ctx.cell(
          { method: "POST", path: roles(s), body: { role: "odd", permission } },
          ctx.as.cookie("owner"),
        ),
      ).toEqual({ status: 400, code: "UNKNOWN_PERMISSION" });
      expect(
        await ctx.cell(
          {
            method: "PATCH",
            path: `${roles(s)}/${s.roleIds.spare}`,
            body: { permission },
          },
          ctx.as.cookie("owner"),
        ),
      ).toEqual({ status: 400, code: "UNKNOWN_PERMISSION" });
    }
  });

  it("refuses to delete a role in use (409) and a seeded role (400)", async () => {
    const s = await ctx.seed("custom");
    const before = await snapshot(s.workspaceId);
    expect(
      await ctx.cell(
        { method: "DELETE", path: `${roles(s)}/${s.roleIds.reviewer}` },
        ctx.as.cookie("owner2"),
      ),
    ).toEqual({ status: 409, code: "ROLE_IN_USE" });
    expect(
      await ctx.cell(
        { method: "DELETE", path: `${roles(s)}/${s.roleIds.viewer}` },
        ctx.as.cookie("owner2"),
      ),
    ).toEqual({ status: 400, code: "DEFAULT_ROLE" });
    expect(await snapshot(s.workspaceId)).toEqual(before);
  });

  it("refuses a role that grants more than the actor holds", async () => {
    const s = await ctx.seed("admin");
    expect(
      await ctx.cell(
        ACTIONS["roles.create-beyond-own"]!(s),
        ctx.as.cookie("admin"),
      ),
    ).toEqual({ status: 403, code: "ROLE_EXCEEDS_YOUR_PERMISSIONS" });
  });
});
