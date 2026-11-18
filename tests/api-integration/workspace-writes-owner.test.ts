import { and, eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { workspaceMemberAccessTable } from "../../apps/api/src/database/schema";
import { resetTestDatabase } from "./helpers/database";
import { holdRowLock, releaseWhenQueued } from "./helpers/row-lock";
import {
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

async function owners(workspaceId: string) {
  const rows = await db
    .select({
      userId: schema.workspaceUserTable.userId,
      role: schema.workspaceUserTable.role,
    })
    .from(schema.workspaceUserTable)
    .where(eq(schema.workspaceUserTable.workspaceId, workspaceId));
  return rows
    .filter((row) => row.role === "owner")
    .map((row) => row.userId)
    .sort();
}

/** A workspace whose only owner is `owner`, with `target` and `admin` members. */
async function soleOwner(): Promise<Seeded> {
  const seeded = await ctx.seed("owner");
  await db
    .delete(schema.workspaceUserTable)
    .where(
      and(
        eq(schema.workspaceUserTable.workspaceId, seeded.workspaceId),
        eq(schema.workspaceUserTable.userId, seeded.userIds.owner2!),
      ),
    );
  await db.insert(schema.workspaceUserTable).values({
    workspaceId: seeded.workspaceId,
    userId: ctx.people.admin.userId,
    role: "admin",
    joinedAt: new Date(Date.now() + 10_000),
  });
  return seeded;
}

const transfer = (s: Seeded, to: string, by = ctx.as.cookie("owner")) =>
  ctx.call(
    {
      method: "PUT",
      path: `/workspace/${s.workspaceId}/owner`,
      body: { userId: to },
    },
    by,
  );
const remove = (s: Seeded, userId: string, by = ctx.as.cookie("owner")) =>
  ctx.call(
    { method: "DELETE", path: `/workspace/${s.workspaceId}/members/${userId}` },
    by,
  );
const setRole = (
  s: Seeded,
  userId: string,
  role: string,
  by = ctx.as.cookie("owner"),
) =>
  ctx.call(
    {
      method: "PUT",
      path: `/workspace/${s.workspaceId}/members/${userId}/role`,
      body: { role },
    },
    by,
  );
const code = async (response: Response) =>
  ((await response.json()) as { code?: string }).code;

describe("the only owner (A3)", () => {
  it("cannot leave, be removed or be demoted", async () => {
    const s = await soleOwner();
    const me = ctx.people.owner.userId;
    const before = await snapshot(s.workspaceId);
    const attempts = [
      await ctx.call(
        { method: "POST", path: `/workspace/${s.workspaceId}/leave` },
        ctx.as.cookie("owner"),
      ),
      await remove(s, me),
      await setRole(s, me, "admin"),
      await ctx.call(
        {
          method: "DELETE",
          path: `/admin/workspaces/${s.workspaceId}/members/${me}`,
        },
        ctx.as.cookie("instanceAdmin"),
      ),
      await ctx.call(
        {
          method: "PUT",
          path: `/admin/workspaces/${s.workspaceId}/members/${me}/role`,
          body: { role: "admin" },
        },
        ctx.as.cookie("instanceAdmin"),
      ),
    ];
    for (const response of attempts) {
      expect(response.status).toBe(409);
      expect(await code(response)).toBe("ONLY_OWNER");
    }
    expect(await snapshot(s.workspaceId)).toEqual(before);
  });

  it("leaves exactly one new owner after two concurrent transfers", async () => {
    const s = await soleOwner();
    const lock = await holdRowLock("workspace", s.workspaceId);
    const [first, second] = await releaseWhenQueued(lock, [
      { start: () => [transfer(s, ctx.people.target.userId)], waiters: 1 },
      { start: () => [transfer(s, ctx.people.admin.userId)], waiters: 2 },
    ]);
    expect(first.status).toBe(200);
    // The caller is an admin once the first commits.
    expect(second.status).toBe(403);
    expect(await code(second)).toBe("OWNER_REQUIRED");
    expect(await owners(s.workspaceId)).toEqual([ctx.people.target.userId]);
  });

  it("keeps the new owner when a removal of them queues behind the transfer", async () => {
    const s = await soleOwner();
    const lock = await holdRowLock("workspace", s.workspaceId);
    const [transferred, removed] = await releaseWhenQueued(lock, [
      { start: () => [transfer(s, ctx.people.target.userId)], waiters: 1 },
      { start: () => [remove(s, ctx.people.target.userId)], waiters: 2 },
    ]);
    expect(transferred.status).toBe(200);
    expect(removed.status).toBe(403);
    expect(await code(removed)).toBe("OWNER_REQUIRED");
    expect(await owners(s.workspaceId)).toEqual([ctx.people.target.userId]);
  });

  it("keeps the owner when a transfer queues behind the target's removal", async () => {
    const s = await soleOwner();
    const lock = await holdRowLock("workspace", s.workspaceId);
    const [removed, transferred] = await releaseWhenQueued(lock, [
      { start: () => [remove(s, ctx.people.target.userId)], waiters: 1 },
      { start: () => [transfer(s, ctx.people.target.userId)], waiters: 2 },
    ]);
    expect(removed.status).toBe(200);
    expect(transferred.status).toBe(404);
    expect(await code(transferred)).toBe("MEMBER_NOT_FOUND");
    expect(await owners(s.workspaceId)).toEqual([ctx.people.owner.userId]);
  });

  it("never leaves a workspace ownerless when its two owners remove each other", async () => {
    const s = await ctx.seed("owner");
    const lock = await holdRowLock("workspace", s.workspaceId);
    const [a, b] = await releaseWhenQueued(lock, [
      { start: () => [remove(s, s.userIds.owner2!)], waiters: 1 },
      {
        start: () => [
          remove(s, ctx.people.owner.userId, ctx.as.cookie("owner2")),
        ],
        waiters: 2,
      },
    ]);
    expect(a.status).toBe(200);
    // owner2 is gone by the time its own request re-reads membership.
    expect(b.status).toBe(403);
    expect(await code(b)).toBe("MEMBERSHIP_REQUIRED");
    expect(await owners(s.workspaceId)).toEqual([ctx.people.owner.userId]);
  });
});

describe("owners are protected from non-owners (A4)", () => {
  it("refuses an admin who removes or changes an owner, or promotes to owner", async () => {
    const s = await ctx.seed("admin");
    const before = await snapshot(s.workspaceId);
    const admin = ctx.as.cookie("admin");
    for (const response of [
      await remove(s, s.userIds.owner2!, admin),
      await setRole(s, s.userIds.owner2!, "member", admin),
    ]) {
      expect(response.status).toBe(403);
      expect(await code(response)).toBe("OWNER_REQUIRED");
    }
    const promoted = await setRole(s, s.userIds.target!, "owner", admin);
    expect(promoted.status).toBe(400);
    expect(await code(promoted)).toBe("UNKNOWN_ROLE");
    const transferred = await transfer(s, s.userIds.target!, admin);
    expect(transferred.status).toBe(403);
    expect(await code(transferred)).toBe("OWNER_REQUIRED");
    expect(await snapshot(s.workspaceId)).toEqual(before);
  });

  it("gives owner only by transfer, on the member and the admin role routes", async () => {
    const s = await ctx.seed("owner");
    const byOwner = await setRole(s, s.userIds.target!, "owner");
    expect(byOwner.status).toBe(400);
    expect(await code(byOwner)).toBe("UNKNOWN_ROLE");
    const byAdmin = await ctx.call(
      {
        method: "PUT",
        path: `/admin/workspaces/${s.workspaceId}/members/${s.userIds.target}/role`,
        body: { role: "owner" },
      },
      ctx.as.cookie("instanceAdmin"),
    );
    expect(byAdmin.status).toBe(400);
    expect(await owners(s.workspaceId)).toEqual(
      [ctx.people.owner.userId, ctx.people.owner2.userId].sort(),
    );
  });
});

describe("promotion to owner clears project access (A5)", () => {
  async function limitTarget(s: Seeded) {
    await db.insert(workspaceMemberAccessTable).values({
      workspaceId: s.workspaceId,
      userId: s.userIds.target!,
      projectAccess: "selected",
    });
  }
  const targetAccess = (s: Seeded) =>
    db
      .select()
      .from(workspaceMemberAccessTable)
      .where(eq(workspaceMemberAccessTable.userId, s.userIds.target!));

  it("on the member transfer and the admin transfer, with project_access.updated", async () => {
    for (const via of ["member", "admin"] as const) {
      const s = await soleOwner();
      await limitTarget(s);
      const events = await watchEvents();
      const response =
        via === "member"
          ? await transfer(s, s.userIds.target!)
          : await ctx.call(
              {
                method: "PUT",
                path: `/admin/workspaces/${s.workspaceId}/owner`,
                body: { userId: s.userIds.target },
              },
              ctx.as.cookie("instanceAdmin"),
            );
      expect([via, response.status]).toEqual([via, 200]);
      expect(await targetAccess(s)).toEqual([]);
      expect(events.types()).toContain("project_access.updated");
      expect(await owners(s.workspaceId)).toEqual([s.userIds.target]);
    }
  });

  it("rolls the promotion back when the cleanup fails", async () => {
    const s = await soleOwner();
    await limitTarget(s);
    const before = await snapshot(s.workspaceId);
    const events = await watchEvents();
    await db.execute(sql`
      CREATE FUNCTION refuse_access_delete() RETURNS trigger LANGUAGE plpgsql AS
        $$ BEGIN RAISE EXCEPTION 'access delete refused'; END $$;
      CREATE TRIGGER refuse_access_delete BEFORE DELETE
        ON workspace_member_access FOR EACH ROW EXECUTE FUNCTION refuse_access_delete();
    `);
    try {
      const response = await transfer(s, s.userIds.target!);
      expect(response.status).toBe(500);
    } finally {
      await db.execute(sql`
        DROP TRIGGER refuse_access_delete ON workspace_member_access;
        DROP FUNCTION refuse_access_delete();
      `);
    }
    expect(await snapshot(s.workspaceId)).toEqual(before);
    expect(await owners(s.workspaceId)).toEqual([ctx.people.owner.userId]);
    expect(events.types()).not.toContain("project_access.updated");
  });
});

describe("an ambiguous stored owner token never acts as owner", () => {
  it.each(["member, owner", "recruiter, owner", "admin, owner"])(
    "%j cannot remove, demote or replace an owner",
    async (role) => {
      const s = await ctx.seed("admin", { role });
      const before = await snapshot(s.workspaceId);
      const admin = ctx.as.cookie("admin");
      const capabilities = await ctx.call(
        { method: "GET", path: `/workspace/${s.workspaceId}/capabilities` },
        admin,
      );
      expect(capabilities.status).toBe(200);
      expect(await capabilities.json()).toMatchObject({
        deleteWorkspace: false,
      });
      for (const response of [
        await remove(s, s.userIds.owner2!, admin),
        await setRole(s, s.userIds.owner2!, "member", admin),
        await transfer(s, s.userIds.target!, admin),
      ])
        expect(response.status).toBe(403);
      expect(await snapshot(s.workspaceId)).toEqual(before);
    },
  );
});
