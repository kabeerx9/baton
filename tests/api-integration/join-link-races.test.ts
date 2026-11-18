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
import {
  workspaceJoinLinkTable,
  workspaceMemberRemovalTable,
} from "../../apps/api/src/database/schema";
import { resetJoinLinkRateLimits } from "../../apps/api/src/join-link/rate-limit";
import { resetTestDatabase } from "./helpers/database";
import { joinLinkFixture, linkRow, memberRows } from "./helpers/join-link";
import {
  holdRowLock,
  releaseWhenQueued,
  waitForLockWaiters,
} from "./helpers/row-lock";

// Each race is forced: a separate connection holds a row lock while the
// contenders start, the test waits until they all queue on a lock, then
// releases them together. A regression in lock order or in re-reading the
// link under its lock fails these tests instead of passing by luck.

beforeEach(async () => {
  await resetTestDatabase();
  resetJoinLinkRateLimits();
  vi.stubEnv("NOTIFICATION_SECRET_ENCRYPTION_KEY", "join-link-test-key");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

type Fixture = Awaited<ReturnType<typeof joinLinkFixture>>;

function deleteWorkspace(ctx: Fixture) {
  return ctx.call("/auth/organization/delete", {
    method: "POST",
    body: { organizationId: ctx.workspace.id },
    headers: { cookie: ctx.owner.cookies },
  });
}

async function code(response: Response) {
  return ((await response.json()) as { code?: string }).code;
}

describe("join races", () => {
  it("gives the last seat to exactly one of two queued joins (7)", async () => {
    const ctx = await joinLinkFixture();
    const { link, token } = await ctx.createLink({ maxUses: 1 });
    const first = await ctx.person();
    const second = await ctx.person();

    // Both joins read the link unlocked, then queue on the workspace lock.
    const lock = await holdRowLock("workspace", ctx.workspace.id);
    const responses = await releaseWhenQueued(lock, [
      {
        start: () => [ctx.join(first, token), ctx.join(second, token)],
        waiters: 2,
      },
    ]);

    expect(responses.map((response) => response.status).sort()).toEqual([
      200, 410,
    ]);
    const refused = responses.find((response) => response.status === 410)!;
    expect(await code(refused)).toBe("JOIN_LINK_USED_UP");
    const joined = [
      ...(await memberRows(ctx.workspace.id, first.userId)),
      ...(await memberRows(ctx.workspace.id, second.userId)),
    ];
    expect(joined).toHaveLength(1);
    expect((await linkRow(link.id))?.useCount).toBe(1);
  });

  it("adds one member row when the same person's two joins queue together (8)", async () => {
    const ctx = await joinLinkFixture();
    const { link, token } = await ctx.createLink();
    const joiner = await ctx.person();

    const lock = await holdRowLock("workspace", ctx.workspace.id);
    const responses = await releaseWhenQueued(lock, [
      {
        start: () => [ctx.join(joiner, token), ctx.join(joiner, token)],
        waiters: 2,
      },
    ]);

    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    const outcomes = await Promise.all(
      responses.map(
        async (response) =>
          ((await response.json()) as { outcome: string }).outcome,
      ),
    );
    expect(outcomes.sort()).toEqual(["already_member", "joined"]);
    expect(await memberRows(ctx.workspace.id, joiner.userId)).toHaveLength(1);
    expect((await linkRow(link.id))?.useCount).toBe(1);
  });

  it("orders a join and a workspace delete without a deadlock (19)", async () => {
    const ctx = await joinLinkFixture();
    const { link, token } = await ctx.createLink();
    const joiner = await ctx.person();

    // Holding the link row: a join that locks the workspace first then waits
    // on the link, and the delete waits on the workspace. A join that locked
    // the link first would instead deadlock with the delete's cascade.
    const lock = await holdRowLock("workspace_join_link", link.id);
    const [joined, removed] = await releaseWhenQueued(lock, [
      { start: () => [ctx.join(joiner, token)], waiters: 1 },
      { start: () => [deleteWorkspace(ctx)], waiters: 2 },
    ]);

    expect(joined.status).toBe(200);
    expect(await joined.json()).toMatchObject({ outcome: "joined" });
    expect(removed.status).toBe(200);
    expect(
      await db
        .select()
        .from(workspaceJoinLinkTable)
        .where(eq(workspaceJoinLinkTable.workspaceId, ctx.workspace.id)),
    ).toEqual([]);
    expect(
      await db
        .select()
        .from(schema.workspaceTable)
        .where(eq(schema.workspaceTable.id, ctx.workspace.id)),
    ).toEqual([]);
  });

  it("refuses a join queued behind a workspace delete with 404", async () => {
    const ctx = await joinLinkFixture();
    const { token } = await ctx.createLink();
    const joiner = await ctx.person();

    const lock = await holdRowLock("workspace", ctx.workspace.id);
    const [removed, joined] = await releaseWhenQueued(lock, [
      { start: () => [deleteWorkspace(ctx)], waiters: 1 },
      { start: () => [ctx.join(joiner, token)], waiters: 2 },
    ]);

    expect(removed.status).toBe(200);
    expect(joined.status).toBe(404);
    expect(await code(joined)).toBe("JOIN_LINK_NOT_FOUND");
  });
});

describe("join races with a removal (4)", () => {
  it("refuses a join queued behind an admin removal", async () => {
    const ctx = await joinLinkFixture();
    const { token } = await ctx.createLink();
    const joiner = await ctx.person("Racing Person");
    expect((await ctx.join(joiner, token)).status).toBe(200);
    const instanceAdmin = await ctx.person("Instance Admin", "admin");

    const lock = await holdRowLock("workspace", ctx.workspace.id);
    const [removed, joined] = await releaseWhenQueued(lock, [
      {
        start: () => [
          ctx.call(
            `/admin/workspaces/${ctx.workspace.id}/members/${joiner.userId}`,
            { method: "DELETE", headers: { cookie: instanceAdmin.cookies } },
          ),
        ],
        waiters: 1,
      },
      { start: () => [ctx.join(joiner, token)], waiters: 2 },
    ]);

    expect(removed.status).toBe(200);
    expect(joined.status).toBe(403);
    expect(await code(joined)).toBe("REMOVED_FROM_WORKSPACE");
    expect(await memberRows(ctx.workspace.id, joiner.userId)).toEqual([]);
  });

  it("never readmits a person while Better Auth removes them", async () => {
    const ctx = await joinLinkFixture();
    const joiner = await ctx.person("Racing Person");
    // An older removal gives the marker row a lock to hold. It predates the
    // link, so this link admits the person until the new removal.
    await db.insert(workspaceMemberRemovalTable).values({
      workspaceId: ctx.workspace.id,
      userId: joiner.userId,
      removedAt: new Date(Date.now() - 86_400_000),
    });
    const { token } = await ctx.createLink();
    expect((await ctx.join(joiner, token)).status).toBe(200);

    // The removal stops where it writes the marker. Written before the
    // delete, the person is still a member there, so a join is a no-op. An
    // implementation that wrote it after the delete would let this join in.
    const lock = await holdRowLock("workspace_member_removal", {
      workspace_id: ctx.workspace.id,
      user_id: joiner.userId,
    });
    let removal: Promise<Response> | undefined;
    let duringRemoval: Response;
    try {
      removal = ctx.call("/auth/organization/remove-member", {
        method: "POST",
        body: {
          organizationId: ctx.workspace.id,
          memberIdOrEmail: "racing-person@example.com",
        },
        headers: { cookie: ctx.owner.cookies },
      });
      await waitForLockWaiters(1);
      duringRemoval = await ctx.join(joiner, token);
    } finally {
      await lock.release();
    }
    expect((await removal).status).toBe(200);
    expect(duringRemoval.status).toBe(200);
    expect(await duringRemoval.json()).toMatchObject({
      outcome: "already_member",
    });
    expect(await memberRows(ctx.workspace.id, joiner.userId)).toEqual([]);
    const after = await ctx.join(joiner, token);
    expect(after.status).toBe(403);
    expect(await code(after)).toBe("REMOVED_FROM_WORKSPACE");
  });
});
