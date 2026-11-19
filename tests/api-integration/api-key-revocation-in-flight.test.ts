// auth-boundary P4 A10: a workspace write queued on the workspace lock is
// refused when its key is deleted through `DELETE /api/api-key/{id}`, or
// expires, while it waits. Nothing is written and no event is published.
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { resetTestDatabase } from "./helpers/database";
import { holdRowLock, waitForLockWaiters } from "./helpers/row-lock";
import {
  ACTIONS,
  type Person,
  type Seeded,
  snapshot,
  watchEvents,
  type WritesFixture,
  writesFixture,
} from "./helpers/workspace-writes";

let ctx: WritesFixture;

beforeEach(async () => {
  await resetTestDatabase();
  ctx = await writesFixture();
});

type Member = {
  actor: Person;
  scope: Record<string, string[]>;
  action: string;
};

// One write per family of `workspace-writes-lock.test.ts`.
const MEMBERS: Member[] = [
  {
    actor: "admin",
    scope: { workspace: ["update"] },
    action: "workspace.update",
  },
  {
    actor: "owner",
    scope: { workspace: ["delete"] },
    action: "workspace.delete",
  },
  { actor: "admin", scope: { member: ["delete"] }, action: "member.remove" },
  { actor: "admin", scope: { member: ["update"] }, action: "member.role" },
  { actor: "admin", scope: { role: ["create"] }, action: "roles.create" },
  {
    actor: "member",
    scope: { workspace: ["manage_settings"] },
    action: "workspace.leave",
  },
];

async function raceUnderLock(
  member: Member,
  change: (s: Seeded, key: { id: string; key: string }) => Promise<void>,
) {
  const s = await ctx.seed(member.actor);
  const key = await ctx.keyFor(member.actor, member.scope);
  const lock = await holdRowLock("workspace", s.workspaceId);
  const events = await watchEvents();
  let pending: Promise<Response> | undefined;
  let expected: Awaited<ReturnType<typeof snapshot>>;
  try {
    pending = ctx.call(ACTIONS[member.action]!(s), ctx.as.key(key.key));
    await waitForLockWaiters(1);
    await change(s, key);
    expected = await snapshot(s.workspaceId);
  } finally {
    await lock.release();
  }
  const response = await pending!;
  const body = (await response.json()) as { code?: string };
  return {
    cell: { status: response.status, code: body.code ?? null },
    unchanged:
      JSON.stringify(await snapshot(s.workspaceId)) ===
      JSON.stringify(expected!),
    events: events.types(),
  };
}

const refused = {
  cell: { status: 403, code: "CREDENTIAL_REVOKED" },
  unchanged: true,
  events: [],
};

describe("key revocation in flight (A10)", () => {
  it.each(MEMBERS.map((member) => [member.action, member] as const))(
    "%s: the owner deletes the key while the write waits",
    { timeout: 60_000 },
    async (_, member) => {
      const result = await raceUnderLock(member, async (_s, key) => {
        const deleted = await ctx.call(
          { method: "DELETE", path: `/api-key/${key.id}` },
          ctx.as.cookie(member.actor),
        );
        expect(deleted.status).toBe(200);
        expect(
          await db
            .select()
            .from(schema.apikeyTable)
            .where(eq(schema.apikeyTable.id, key.id)),
        ).toEqual([]);
      });
      expect(result).toEqual(refused);
    },
  );

  it.each(MEMBERS.map((member) => [member.action, member] as const))(
    "%s: the key expires while the write waits",
    { timeout: 60_000 },
    async (_, member) => {
      const result = await raceUnderLock(member, async (_s, key) => {
        const expiresAt = new Date(Date.now() + 200);
        await db
          .update(schema.apikeyTable)
          .set({ expiresAt })
          .where(eq(schema.apikeyTable.id, key.id));
        while (Date.now() <= expiresAt.getTime() + 50)
          await new Promise((resolve) => setTimeout(resolve, 25));
      });
      expect(result).toEqual(refused);
    },
  );

  it("lets the same write through when nothing changes while it waits", async () => {
    const result = await raceUnderLock(MEMBERS[0]!, async () => {});
    expect(result.cell.status).toBe(200);
  });
});
