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
import { workspaceJoinLinkTable } from "../../apps/api/src/database/schema";
import { resetJoinLinkRateLimits } from "../../apps/api/src/join-link/rate-limit";
import { resetTestDatabase } from "./helpers/database";
import { joinLinkFixture, linkRow, memberRows } from "./helpers/join-link";

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

describe("join races", () => {
  it("gives the last seat to exactly one of two parallel joins (7)", async () => {
    const ctx = await joinLinkFixture();
    const { link, token } = await ctx.createLink({ maxUses: 1 });
    const first = await ctx.person();
    const second = await ctx.person();

    const responses = await Promise.all([
      ctx.join(first, token),
      ctx.join(second, token),
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

  it("adds one member row when the same person joins twice in parallel (8)", async () => {
    const ctx = await joinLinkFixture();
    const { link, token } = await ctx.createLink();
    const joiner = await ctx.person();

    const responses = await Promise.all([
      ctx.join(joiner, token),
      ctx.join(joiner, token),
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

  it("removes the links on workspace delete, and a parallel join never deadlocks (19)", async () => {
    for (let round = 0; round < 3; round += 1) {
      await resetTestDatabase();
      resetJoinLinkRateLimits();
      const ctx = await joinLinkFixture();
      const { token } = await ctx.createLink();
      const joiner = await ctx.person();

      const [joined, deleted] = await Promise.all([
        ctx.join(joiner, token),
        ctx.call("/auth/organization/delete", {
          method: "POST",
          body: { organizationId: ctx.workspace.id },
          headers: { cookie: ctx.owner.cookies },
        }),
      ]);
      expect(deleted.status).toBe(200);
      // Either the join committed first, or it found the workspace gone.
      expect([200, 404]).toContain(joined.status);
      if (joined.status === 404)
        expect(await code(joined)).toBe("JOIN_LINK_NOT_FOUND");

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
    }
  });
});
