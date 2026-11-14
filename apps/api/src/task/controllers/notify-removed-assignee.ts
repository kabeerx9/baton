import createNotification from "../../notification/controllers/create-notification";

/**
 * The person a task was taken from hears about it; the new assignee already
 * gets the assignment notification. Nobody is told about their own action.
 */
export async function notifyRemovedAssignee(
  before: { userId: string | null },
  after: { id: string; title: string; userId: string | null },
  actorId: string | null,
) {
  if (!before.userId || before.userId === after.userId) return;
  if (before.userId === actorId) return;
  try {
    await createNotification({
      userId: before.userId,
      type: "task_unassigned",
      title: `"${after.title}" is no longer assigned to you`,
      content: null,
      eventData: { taskTitle: after.title },
      resourceId: after.id,
      resourceType: "task",
    });
  } catch (error) {
    console.error("Failed to notify the previous assignee", error);
  }
}
