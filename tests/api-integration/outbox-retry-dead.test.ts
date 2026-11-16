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
  const log = vi.spyOn(console, "error").mockImplementation(() => {});

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
