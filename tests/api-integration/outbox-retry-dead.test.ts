import { beforeEach, expect, it, vi } from "vite-plus/test";
import { activityOutboxConsumer } from "../../apps/api/src/activity/outbox-consumer";
import { MAX_ATTEMPTS } from "../../apps/api/src/events/outbox/lifecycle";
import updateTaskStatus from "../../apps/api/src/task/controllers/update-task-status";
import { resetTestDatabase } from "./helpers/database";
import {
  drainOutbox,
  makeOutboxDue,
  outboxTaskFixture,
  readActivities,
  readOutbox,
} from "./helpers/outbox";
import { logger } from "../../apps/api/src/observability/logger";

beforeEach(resetTestDatabase);

it("backs off a failing row, makes the sixth failure dead, and keeps delivering others", async () => {
  const poison = await outboxTaskFixture();
  const healthy = await outboxTaskFixture();
  await updateTaskStatus({
    id: poison.task.id,
    status: "done",
    currentUserId: poison.user.id,
  });
  const original = activityOutboxConsumer.deliver;
  vi.spyOn(activityOutboxConsumer, "deliver").mockImplementation(
    async (tx, row, context) => {
      if ((row.payload as { taskId: string }).taskId === poison.task.id)
        throw Object.assign(new Error(`secret ${poison.task.title}`), {
          code: "E_POISON",
        });
      return original(tx, row, context);
    },
  );
  const log = vi.spyOn(logger, "error").mockImplementation(() => {});

  for (let attempt = 1; attempt < MAX_ATTEMPTS; attempt++) {
    await drainOutbox();
    const [row] = await readOutbox();
    expect(row).toMatchObject({
      state: "pending",
      attempts: attempt,
      lastError: "E_POISON",
    });
    // The retry waits: an immediate drain does not run it again.
    expect(row!.nextAttemptAt.getTime()).toBeGreaterThan(Date.now() + 3_000);
    expect(await drainOutbox()).toBe(0);
    await makeOutboxDue();
  }

  // Another task's row is delivered while the poison row keeps failing.
  await updateTaskStatus({
    id: healthy.task.id,
    status: "done",
    currentUserId: healthy.user.id,
  });
  await drainOutbox();

  const rows = await readOutbox();
  expect(rows).toEqual([
    expect.objectContaining({
      state: "dead",
      attempts: MAX_ATTEMPTS,
      lastError: "E_POISON",
    }),
  ]);
  expect(await readActivities(healthy.task.id)).toHaveLength(1);
  expect(await readActivities(poison.task.id)).toHaveLength(0);

  // A dead row is never claimed again.
  await makeOutboxDue();
  expect(await drainOutbox()).toBe(0);

  // The dead report names the row but never its payload or error text.
  // (Sentry gets the same facts object as this log line.)
  const logged = JSON.stringify(log.mock.calls);
  expect(logged).toContain(rows[0]!.id);
  expect(logged).not.toContain(poison.task.id);
  expect(logged).not.toContain("secret");
});

it("retries an unknown payload version without running it", async () => {
  const { user, task } = await outboxTaskFixture();
  await updateTaskStatus({
    id: task.id,
    status: "done",
    currentUserId: user.id,
  });
  const { default: db, schema } = await import("../../apps/api/src/database");
  const { sql } = await import("drizzle-orm");
  await db
    .update(schema.outboxTable)
    .set({ payload: sql`jsonb_set(payload, '{v}', '2')` });

  await drainOutbox();
  expect(await readOutbox()).toEqual([
    expect.objectContaining({ state: "pending", lastError: "outcome:unknown" }),
  ]);
  expect(await readActivities(task.id)).toHaveLength(0);
});

it("keeps an unknown payload pending past seven claims, then delivers once it is readable", async () => {
  const { user, task } = await outboxTaskFixture();
  await updateTaskStatus({
    id: task.id,
    status: "done",
    currentUserId: user.id,
  });
  const { default: db, schema } = await import("../../apps/api/src/database");
  const { sql } = await import("drizzle-orm");
  // A row written by a newer version, read during a rollback.
  await db
    .update(schema.outboxTable)
    .set({ payload: sql`jsonb_set(payload, '{v}', '2')` });

  for (let claim = 1; claim <= MAX_ATTEMPTS + 3; claim++) {
    await drainOutbox();
    expect(await readOutbox()).toEqual([
      expect.objectContaining({
        state: "pending",
        attempts: claim,
        exemptClaims: claim,
        lastError: "outcome:unknown",
      }),
    ]);
    await makeOutboxDue();
  }
  expect(await readActivities(task.id)).toHaveLength(0);

  // The compatible version is back: the row runs with its budget intact.
  await db
    .update(schema.outboxTable)
    .set({ payload: sql`jsonb_set(payload, '{v}', '1')` });
  await drainOutbox();
  expect(await readActivities(task.id)).toHaveLength(1);
  expect(await readOutbox()).toHaveLength(0);
});

it("makes an unknown payload dead only after 24 hours", async () => {
  const { user, task } = await outboxTaskFixture();
  await updateTaskStatus({
    id: task.id,
    status: "done",
    currentUserId: user.id,
  });
  const { default: db, schema } = await import("../../apps/api/src/database");
  const { sql } = await import("drizzle-orm");
  await db.update(schema.outboxTable).set({
    payload: sql`jsonb_set(payload, '{v}', '2')`,
    createdAt: sql`(now() AT TIME ZONE 'utc') - interval '25 hours'`,
  });
  vi.spyOn(logger, "error").mockImplementation(() => {});
  await drainOutbox();
  expect(await readOutbox()).toEqual([
    expect.objectContaining({ state: "dead", lastError: "outcome:unknown" }),
  ]);
});

it("requeues a dead row without resetting attempts, so a stale completion from before its death is refused", async () => {
  const { user, task } = await outboxTaskFixture();
  await updateTaskStatus({
    id: task.id,
    status: "done",
    currentUserId: user.id,
  });
  const { default: db, schema } = await import("../../apps/api/src/database");
  const { sql } = await import("drizzle-orm");
  const { claimOutboxRows } =
    await import("../../apps/api/src/events/outbox/claim");
  const { deliverOutboxRow } =
    await import("../../apps/api/src/events/outbox/deliver");
  const { requeueOutboxRow } =
    await import("../../apps/api/src/events/outbox/requeue");

  // A relay claims the row and stalls; the row then dies.
  const [stalled] = await claimOutboxRows(["activity"], 1);
  await db
    .update(schema.outboxTable)
    .set({ state: "dead", nextAttemptAt: sql`(now() AT TIME ZONE 'utc')` });

  expect(await requeueOutboxRow(stalled!.row.id)).toBe(true);
  expect(await requeueOutboxRow(stalled!.row.id)).toBe(false);
  const [requeued] = await readOutbox();
  expect(requeued).toMatchObject({
    state: "pending",
    attempts: 1,
    exemptClaims: 1,
  });

  const [fresh] = await claimOutboxRows(["activity"], 1);
  expect(fresh!.row.attempts).toBe(2);
  // The stalled relay wakes: its fence (attempts 1) matches nothing.
  expect(await deliverOutboxRow(stalled!, { timeoutMs: 5_000 })).toBe("stale");
  expect(await readActivities(task.id)).toHaveLength(0);
  expect(await deliverOutboxRow(fresh!, { timeoutMs: 5_000 })).toBe(
    "delivered",
  );
  expect(await readActivities(task.id)).toHaveLength(1);
});
