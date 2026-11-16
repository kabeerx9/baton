import { beforeEach, expect, it, vi } from "vite-plus/test";
import { startOutboxRelay } from "../../apps/api/src/events/outbox/start-relay";
import updateTaskStatus from "../../apps/api/src/task/controllers/update-task-status";
import { resetTestDatabase } from "./helpers/database";
import {
  outboxTaskFixture,
  readActivities,
  readOutbox,
} from "./helpers/outbox";

beforeEach(resetTestDatabase);

it("delivers a row left by a process that stopped before its relay ran", async () => {
  const { user, task } = await outboxTaskFixture();
  // No relay is running: this is the state a crash right after commit leaves.
  await updateTaskStatus({
    id: task.id,
    status: "done",
    currentUserId: user.id,
  });
  expect(await readOutbox()).toHaveLength(1);
  expect(await readActivities(task.id)).toHaveLength(0);

  const stop = startOutboxRelay({ pollMs: 50 });
  try {
    await vi.waitFor(async () => expect(await readOutbox()).toHaveLength(0), {
      timeout: 5_000,
      interval: 25,
    });
  } finally {
    await stop();
  }

  const activities = await readActivities(task.id);
  expect(activities).toEqual([
    expect.objectContaining({
      userId: user.id,
      eventData: { oldStatus: "to-do", newStatus: "done" },
    }),
  ]);
});

it("wakes on a nudge after commit instead of waiting for the poll", async () => {
  const { user, task } = await outboxTaskFixture();
  const stop = startOutboxRelay({ pollMs: 60_000 });
  try {
    await updateTaskStatus({
      id: task.id,
      status: "in-progress",
      currentUserId: user.id,
    });
    await vi.waitFor(
      async () => expect(await readActivities(task.id)).toHaveLength(1),
      { timeout: 5_000, interval: 25 },
    );
  } finally {
    await stop();
  }
  expect(await readOutbox()).toHaveLength(0);
});
