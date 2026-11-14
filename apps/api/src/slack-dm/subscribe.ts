import { subscribeToEvent } from "../events";
import { slackConfig } from "./config";
import { unblockedMessage, waitingOnYouMessage } from "./messages";
import { sendDm } from "./send-dm";
import { blockedBy, loadTasks, openBlockersOf } from "./task-facts";

/**
 * "Someone is waiting on you": a task was linked as blocked by another task.
 * The blocker's owner hears about it, unless they made the link themselves,
 * own both tasks, or already finished the blocker.
 */
subscribeToEvent<{
  sourceTaskId: string;
  targetTaskId: string;
  relationType: string;
  userId?: string | null;
}>("task-relation.created", async (event) => {
  const config = slackConfig();
  if (!config || event.relationType !== "blocks") return;

  const tasks = await loadTasks(
    [event.sourceTaskId, event.targetTaskId],
    config.clientUrl,
  );
  const blocker = tasks.get(event.sourceTaskId);
  const blocked = tasks.get(event.targetTaskId);
  if (!blocker?.ownerId || !blocked || blocker.completed) return;
  if (blocker.ownerId === event.userId) return;
  if (blocker.ownerId === blocked.ownerId) return;

  await sendDm(
    blocker.ownerId,
    waitingOnYouMessage({ waiterName: blocked.ownerName, blocker, blocked }),
  );
});

/**
 * "You can continue": a task was finished, and it blocked other open tasks.
 * Each of their owners hears about it, unless they finished the blocker
 * themselves.
 */
subscribeToEvent<{ taskId: string; userId?: string | null }>(
  "task.status_changed",
  async (event) => {
    const config = slackConfig();
    if (!config) return;

    const blockedIds = await blockedBy(event.taskId);
    if (blockedIds.length === 0) return;
    const tasks = await loadTasks(
      [event.taskId, ...blockedIds],
      config.clientUrl,
    );
    const blocker = tasks.get(event.taskId);
    if (!blocker?.completed) return;

    for (const id of blockedIds) {
      const blocked = tasks.get(id);
      if (!blocked?.ownerId || blocked.completed) continue;
      if (blocked.ownerId === event.userId) continue;
      await sendDm(
        blocked.ownerId,
        unblockedMessage({
          blocker,
          blocked,
          stillWaitingOn: await openBlockersOf(blocked.id, config.clientUrl),
        }),
      );
    }
  },
);

/**
 * A task that blocks open work got a new owner. They did not see the first
 * "waiting on you" message, so they get it now.
 */
subscribeToEvent<{
  taskId: string;
  newAssigneeId?: string | null;
  userId?: string | null;
}>("task.assignee_changed", async (event) => {
  const config = slackConfig();
  if (!config || !event.newAssigneeId) return;
  if (event.newAssigneeId === event.userId) return;

  const blockedIds = await blockedBy(event.taskId);
  if (blockedIds.length === 0) return;
  const tasks = await loadTasks(
    [event.taskId, ...blockedIds],
    config.clientUrl,
  );
  const blocker = tasks.get(event.taskId);
  if (!blocker || blocker.completed) return;

  for (const id of blockedIds) {
    const blocked = tasks.get(id);
    if (!blocked || blocked.completed) continue;
    if (blocked.ownerId === event.newAssigneeId) continue;
    await sendDm(
      event.newAssigneeId,
      waitingOnYouMessage({ waiterName: blocked.ownerName, blocker, blocked }),
    );
  }
});
