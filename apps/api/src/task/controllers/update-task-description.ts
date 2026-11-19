import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { withLockedTask } from "./with-locked-task";
import { notifyOutsiderEdit } from "../../task-change-request/notify-outsider-edit";
import { taskTable } from "../../database/schema";
import { personActor, type TaskActor } from "../../task-change-request/actor";
import { assertMayEdit } from "../../task-change-request/assert-may-edit";
import { publishTaskMutation } from "./task-mutation-effects";

async function updateTaskDescription({
  id,
  description,
  currentUserId,
  actor = personActor(currentUserId),
}: {
  id: string;
  description: string;
  currentUserId: string;
  actor?: TaskActor;
}) {
  const { before: existingTask, after: updatedTask } = await withLockedTask(
    id,
    async (tx, before) => {
      await assertMayEdit(tx, before, actor);
      const [updatedTask] = await tx
        .update(taskTable)
        .set({ description })
        .where(eq(taskTable.id, id))
        .returning();

      if (!updatedTask) {
        throw new HTTPException(500, {
          message: "Failed to update task description",
        });
      }

      return updatedTask;
    },
  );

  await publishTaskMutation(existingTask, updatedTask, currentUserId, {
    fields: ["description"],
  });
  if (existingTask.description !== updatedTask.description)
    await notifyOutsiderEdit(existingTask, updatedTask.title, currentUserId, [
      "description",
    ]);

  return updatedTask;
}

export default updateTaskDescription;
