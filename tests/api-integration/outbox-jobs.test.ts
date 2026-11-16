import { sql } from "drizzle-orm";
import { beforeEach, expect, it, vi } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { subscribeToEvent } from "../../apps/api/src/events";
import { claimOutboxRows } from "../../apps/api/src/events/outbox/claim";
import { deliverOutboxRow } from "../../apps/api/src/events/outbox/deliver";
import { checkOutboxHealth } from "../../apps/api/src/events/outbox/health";
import { pruneDeadOutboxRows } from "../../apps/api/src/events/outbox/prune";
import updateTaskStatus from "../../apps/api/src/task/controllers/update-task-status";
import { resetTestDatabase } from "./helpers/database";
import {
  outboxTaskFixture,
  readActivities,
  readOutbox,
} from "./helpers/outbox";

beforeEach(resetTestDatabase);

async function seedRow(
  workspaceId: string,
  id: string,
  state: string,
  nextAttemptAt: string,
) {
  await db.insert(schema.outboxTable).values({
    id,
    workspaceId,
    type: "task.status_changed",
    consumer: "activity",
    payload: { v: 1 },
    state,
    nextAttemptAt: sql.raw(
      `(now() AT TIME ZONE 'utc') + interval '${nextAttemptAt}'`,
    ) as unknown as Date,
  });
}

it("prunes dead rows 30 days after they died and keeps the rest", async () => {
  const { workspace } = await outboxTaskFixture();
  await seedRow(workspace.id, "old-dead", "dead", "-31 days");
  await seedRow(workspace.id, "old-unknown-state", "weird", "-31 days");
  await seedRow(workspace.id, "recent-dead", "dead", "-29 days");
  await seedRow(workspace.id, "old-pending", "pending", "-31 days");

  expect(await pruneDeadOutboxRows()).toEqual({ deleted: 2 });
  expect((await readOutbox()).map((row) => row.id).sort()).toEqual([
    "old-pending",
    "recent-dead",
  ]);
});

it("reports degraded for a row due and unclaimed for 5 minutes", async () => {
  const { workspace } = await outboxTaskFixture();
  await seedRow(workspace.id, "stuck", "pending", "-6 minutes");
  expect(await checkOutboxHealth()).toMatchObject({
    degraded: true,
    stuck: 1,
    newDead: 0,
  });
});

it("reports degraded for a row that died in the last 5 minutes", async () => {
  const { workspace } = await outboxTaskFixture();
  await seedRow(workspace.id, "died", "dead", "-1 minute");
  await seedRow(workspace.id, "died-long-ago", "dead", "-2 days");
  expect(await checkOutboxHealth()).toMatchObject({
    degraded: true,
    stuck: 0,
    newDead: 1,
  });
});

it("is healthy with a leased row, a row in backoff and a fresh row", async () => {
  const { workspace } = await outboxTaskFixture();
  await seedRow(workspace.id, "leased", "pending", "50 seconds");
  await seedRow(workspace.id, "backoff", "pending", "10 minutes");
  await seedRow(workspace.id, "fresh", "pending", "-10 seconds");
  expect(await checkOutboxHealth()).toEqual({
    degraded: false,
    stuck: 0,
    newDead: 0,
  });
});

it("sends a refetch hint after a delivery older than one second, and none for a fresh one", async () => {
  const { user, task } = await outboxTaskFixture();
  const hint = vi.fn(async () => undefined);
  await subscribeToEvent("task.updated", hint);

  await updateTaskStatus({
    id: task.id,
    status: "in-progress",
    currentUserId: user.id,
  });
  const [fresh] = await claimOutboxRows(["activity"], 1);
  expect(
    await deliverOutboxRow({ ...fresh!, ageMs: 200 }, { timeoutMs: 5_000 }),
  ).toBe("delivered");
  expect(hint).not.toHaveBeenCalled();

  await updateTaskStatus({
    id: task.id,
    status: "done",
    currentUserId: user.id,
  });
  const [late] = await claimOutboxRows(["activity"], 1);
  expect(
    await deliverOutboxRow({ ...late!, ageMs: 1_500 }, { timeoutMs: 5_000 }),
  ).toBe("delivered");
  expect(hint).toHaveBeenCalledWith(
    expect.objectContaining({
      taskId: task.id,
      projectId: task.projectId,
      userId: user.id,
    }),
  );
  expect(await readActivities(task.id)).toHaveLength(2);
});
