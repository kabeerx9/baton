import { inArray, sql } from "drizzle-orm";
import type { PoolClient } from "pg";
import { afterEach, beforeEach, expect, it } from "vite-plus/test";
import db, { getDatabasePool, schema } from "../../apps/api/src/database";
import { claimOutboxRows } from "../../apps/api/src/events/outbox/claim";
import { deliverOutboxRow } from "../../apps/api/src/events/outbox/deliver";
import { enqueueEvents } from "../../apps/api/src/events/outbox/enqueue";
import { resetTestDatabase } from "./helpers/database";
import {
  outboxTaskFixture,
  readActivities,
  readOutbox,
} from "./helpers/outbox";

let client: PoolClient | undefined;
beforeEach(resetTestDatabase);
afterEach(async () => {
  await client?.query("ROLLBACK").catch(() => undefined);
  client?.release();
  client = undefined;
});

async function enqueueStatusChanges(count: number) {
  const { user, task } = await outboxTaskFixture();
  await enqueueEvents(
    db,
    Array.from({ length: count }, (_, index) => ({
      type: "task.status_changed",
      data: {
        taskId: task.id,
        projectId: task.projectId,
        userId: user.id,
        oldStatus: `s${index}`,
        newStatus: `s${index + 1}`,
        type: "status_changed",
      },
    })),
  );
  return { user, task };
}

const ids = (claimed: Array<{ row: { id: string } }>) =>
  claimed.map((c) => c.row.id);

it("gives two relays disjoint rows", async () => {
  await enqueueStatusChanges(10);
  const [first, second] = await Promise.all([
    claimOutboxRows(["activity"], 6),
    claimOutboxRows(["activity"], 6),
  ]);
  const all = [...ids(first), ...ids(second)];
  expect(new Set(all).size).toBe(all.length);
  expect(all).toHaveLength(10);
  expect((await readOutbox()).every((row) => row.attempts === 1)).toBe(true);
});

it("skips rows another relay holds mid-claim", async () => {
  await enqueueStatusChanges(5);
  const held = (await readOutbox()).slice(0, 3).map((row) => row.id);
  client = await getDatabasePool().connect();
  await client.query("BEGIN");
  await client.query("SELECT id FROM outbox WHERE id = ANY($1) FOR UPDATE", [
    held,
  ]);

  const claimed = await claimOutboxRows(["activity"], 10);
  expect(ids(claimed).sort()).toEqual(
    (await readOutbox())
      .map((row) => row.id)
      .filter((id) => !held.includes(id))
      .sort(),
  );
});

it("reclaims a row whose lease expired and refuses the stale completion", async () => {
  const { task } = await enqueueStatusChanges(1);
  const [stale] = await claimOutboxRows(["activity"], 1);
  expect(stale!.row.attempts).toBe(1);
  // Not due while the lease holds.
  expect(await claimOutboxRows(["activity"], 1)).toHaveLength(0);

  await db.update(schema.outboxTable).set({
    nextAttemptAt: sql`(now() AT TIME ZONE 'utc') - interval '1 second'`,
  });
  const [fresh] = await claimOutboxRows(["activity"], 1);
  expect(fresh!.row).toMatchObject({ id: stale!.row.id, attempts: 2 });

  // The first relay finishes late: its delete is fenced out and its
  // activity insert rolls back with it.
  expect(await deliverOutboxRow(stale!, { timeoutMs: 5_000 })).toBe("stale");
  expect(await readActivities(task.id)).toHaveLength(0);
  expect(await readOutbox()).toEqual([
    expect.objectContaining({ state: "pending", attempts: 2, lastError: null }),
  ]);

  expect(await deliverOutboxRow(fresh!, { timeoutMs: 5_000 })).toBe(
    "delivered",
  );
  expect(await readActivities(task.id)).toHaveLength(1);
  expect(await readOutbox()).toHaveLength(0);
});

it("does not start a row after its lease", async () => {
  const { task } = await enqueueStatusChanges(1);
  const [claimed] = await claimOutboxRows(["activity"], 1);
  const late = { ...claimed!, claimedAt: claimed!.claimedAt - 60_000 };
  expect(await deliverOutboxRow(late, { timeoutMs: 5_000 })).toBe("skipped");
  expect(await readActivities(task.id)).toHaveLength(0);
  expect(
    await db
      .select()
      .from(schema.outboxTable)
      .where(inArray(schema.outboxTable.id, [claimed!.row.id])),
  ).toEqual([expect.objectContaining({ attempts: 1, state: "pending" })]);
});
