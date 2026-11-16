import { beforeEach, expect, it, vi } from "vite-plus/test";
import { activityOutboxConsumer } from "../../apps/api/src/activity/outbox-consumer";
import { claimOutboxRows } from "../../apps/api/src/events/outbox/claim";
import { deliverOutboxRow } from "../../apps/api/src/events/outbox/deliver";
import { publishTaskMutation } from "../../apps/api/src/task/controllers/task-mutation-effects";
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

it("redelivers a handler that failed after its insert and keeps one activity row", async () => {
  const { user, task } = await outboxTaskFixture();
  await updateTaskStatus({
    id: task.id,
    status: "done",
    currentUserId: user.id,
  });
  const original = activityOutboxConsumer.deliver;
  vi.spyOn(activityOutboxConsumer, "deliver").mockImplementationOnce(
    async (...args) => {
      await original(...args);
      throw new Error("crash after the insert");
    },
  );

  await drainOutbox();
  expect(await readActivities(task.id)).toHaveLength(0);
  expect(await readOutbox()).toEqual([
    expect.objectContaining({
      state: "pending",
      attempts: 1,
      lastError: "Error",
    }),
  ]);

  await makeOutboxDue();
  await drainOutbox();
  expect(await readActivities(task.id)).toHaveLength(1);
  expect(await readOutbox()).toHaveLength(0);

  // Draining again finds nothing to repeat.
  await drainOutbox();
  expect(await readActivities(task.id)).toHaveLength(1);
});

it("gives one activity row for one status change through updateTaskStatus", async () => {
  const { user, task } = await outboxTaskFixture();
  await updateTaskStatus({
    id: task.id,
    status: "done",
    currentUserId: user.id,
  });
  await drainOutbox();
  expect(await readActivities(task.id)).toHaveLength(1);
});

it("gives one activity row for one status change through a bridge caller", async () => {
  const { user, task } = await outboxTaskFixture();
  await publishTaskMutation(task, { ...task, status: "done" }, user.id, {
    fields: ["status"],
  });
  expect(await readOutbox()).toHaveLength(1);
  await drainOutbox();
  expect(await readActivities(task.id)).toEqual([
    expect.objectContaining({
      userId: user.id,
      eventData: { oldStatus: "to-do", newStatus: "done" },
    }),
  ]);
});

it("drops the row when the task is gone", async () => {
  const { user, task } = await outboxTaskFixture();
  await updateTaskStatus({
    id: task.id,
    status: "done",
    currentUserId: user.id,
  });
  const { default: db, schema } = await import("../../apps/api/src/database");
  const { eq } = await import("drizzle-orm");
  // The task cascade does not reach the outbox: the row outlives the task.
  await db.delete(schema.taskTable).where(eq(schema.taskTable.id, task.id));
  await drainOutbox();
  expect(await readOutbox()).toHaveLength(0);
});

it("keeps one activity row when a handler outlives its timeout", async () => {
  const { user, task } = await outboxTaskFixture();
  await updateTaskStatus({
    id: task.id,
    status: "done",
    currentUserId: user.id,
  });
  const original = activityOutboxConsumer.deliver;
  vi.spyOn(activityOutboxConsumer, "deliver").mockImplementationOnce(
    async (...args) => {
      await new Promise((resolve) => setTimeout(resolve, 150));
      return original(...args);
    },
  );
  const [claimed] = await claimOutboxRows(["activity"], 1);
  expect(await deliverOutboxRow(claimed!, { timeoutMs: 50 })).toBe("retry");
  await new Promise((resolve) => setTimeout(resolve, 300));
  expect(await readActivities(task.id)).toHaveLength(0);

  await makeOutboxDue();
  await drainOutbox();
  expect(await readActivities(task.id)).toHaveLength(1);
  expect(await readOutbox()).toHaveLength(0);
});
