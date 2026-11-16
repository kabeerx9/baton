import { eq } from "drizzle-orm";
import { beforeEach, expect, it, vi } from "vite-plus/test";
import { activityOutboxConsumer } from "../../apps/api/src/activity/outbox-consumer";
import db, { schema } from "../../apps/api/src/database";
import { subscribeToEvent } from "../../apps/api/src/events";
import { claimOutboxRows } from "../../apps/api/src/events/outbox/claim";
import {
  HARD_TIMEOUT_GRACE_MS,
  deliverOutboxRow,
} from "../../apps/api/src/events/outbox/deliver";
import { startOutboxRelay } from "../../apps/api/src/events/outbox/start-relay";
import updateTaskStatus from "../../apps/api/src/task/controllers/update-task-status";
import { resetTestDatabase } from "./helpers/database";
import { addWorkspaceMember } from "./helpers/project-access/add-workspace-member";
import {
  drainOutbox,
  makeOutboxDue,
  outboxTaskFixture,
  readActivities,
  readOutbox,
} from "./helpers/outbox";

beforeEach(resetTestDatabase);

it("records the activity with no user when the actor was deleted before delivery", async () => {
  const { workspace, task } = await outboxTaskFixture();
  const actor = await addWorkspaceMember(workspace.id, "admin");
  // The relay is stopped: the change commits, then the actor goes away.
  await updateTaskStatus({
    id: task.id,
    status: "done",
    currentUserId: actor.id,
  });
  await db.delete(schema.userTable).where(eq(schema.userTable.id, actor.id));

  const stop = startOutboxRelay({ pollMs: 50 });
  try {
    await vi.waitFor(async () => expect(await readOutbox()).toHaveLength(0), {
      timeout: 5_000,
      interval: 25,
    });
  } finally {
    await stop();
  }
  expect(await readActivities(task.id)).toEqual([
    expect.objectContaining({
      userId: null,
      eventData: { oldStatus: "to-do", newStatus: "done" },
    }),
  ]);
});

it("sends the refetch hint when the delivery commits more than 1 s after the event", async () => {
  const { user, task } = await outboxTaskFixture();
  const hint = vi.fn(async () => undefined);
  await subscribeToEvent("task.updated", hint);
  await updateTaskStatus({
    id: task.id,
    status: "done",
    currentUserId: user.id,
  });
  const original = activityOutboxConsumer.deliver;
  vi.spyOn(activityOutboxConsumer, "deliver").mockImplementationOnce(
    async (...args) => {
      // Claimed fresh; the handler itself is slow.
      await new Promise((resolve) => setTimeout(resolve, 1_200));
      return original(...args);
    },
  );
  const [claimed] = await claimOutboxRows(["activity"], 1);
  expect(claimed!.ageMs).toBeLessThan(1_000);
  expect(await deliverOutboxRow(claimed!, { timeoutMs: 5_000 })).toBe(
    "delivered",
  );
  expect(hint).toHaveBeenCalledWith(
    expect.objectContaining({ taskId: task.id, projectId: task.projectId }),
  );
});

it("sends no hint for a delivery that commits quickly", async () => {
  const { user, task } = await outboxTaskFixture();
  const hint = vi.fn(async () => undefined);
  await subscribeToEvent("task.updated", hint);
  await updateTaskStatus({
    id: task.id,
    status: "done",
    currentUserId: user.id,
  });
  await drainOutbox();
  expect(await readActivities(task.id)).toHaveLength(1);
  expect(hint).not.toHaveBeenCalled();
});

it("releases the lane from a handler that never settles and still writes one row", async () => {
  const { user, task } = await outboxTaskFixture();
  await updateTaskStatus({
    id: task.id,
    status: "done",
    currentUserId: user.id,
  });
  let release!: () => void;
  const hung = new Promise<void>((resolve) => {
    release = resolve;
  });
  const original = activityOutboxConsumer.deliver;
  vi.spyOn(activityOutboxConsumer, "deliver").mockImplementationOnce(
    async (...args) => {
      await hung;
      return original(...args);
    },
  );
  const [claimed] = await claimOutboxRows(["activity"], 1);
  const started = performance.now();
  expect(await deliverOutboxRow(claimed!, { timeoutMs: 50 })).toBe("retry");
  expect(performance.now() - started).toBeLessThan(
    50 + HARD_TIMEOUT_GRACE_MS + 1_000,
  );
  expect(await readOutbox()).toEqual([
    expect.objectContaining({ lastError: "OutboxTimeout", state: "pending" }),
  ]);

  // The abandoned handler wakes up: its connection is gone, so it writes nothing.
  release();
  await new Promise((resolve) => setTimeout(resolve, 200));
  expect(await readActivities(task.id)).toHaveLength(0);

  await makeOutboxDue();
  await drainOutbox();
  expect(await readActivities(task.id)).toHaveLength(1);
  expect(await readOutbox()).toHaveLength(0);
});
