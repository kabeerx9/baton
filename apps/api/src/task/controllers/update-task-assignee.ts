import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { withLockedTask } from "./with-locked-task";
import { taskTable } from "../../database/schema";
import { publishTaskMutation } from "./task-mutation-effects";
import {
  assertAssignableUser,
  getProjectWorkspaceId,
} from "../../utils/assert-assignable-user";
import { personActor, type TaskActor } from "../../task-change-request/actor";
import { decideConsent } from "../../task-change-request/consent";
import { loadConsentFacts } from "../../task-change-request/load-consent-facts";
import { consentError } from "../../task-change-request/request-change";
import { notifyRemovedAssignee } from "./notify-removed-assignee";

async function updateTaskAssignee({
  id,
  userId,
  currentUserId,
  actor = personActor(currentUserId),
}: {
  id: string;
  userId: string | null;
  currentUserId: string;
  actor?: TaskActor;
}) {
  const { before: existingTask, after: updatedTask } = await withLockedTask(
    id,
    async (tx, existingTask) => {
      const nextAssigneeId = userId?.trim() || null;
      if (existingTask.userId === nextAssigneeId) {
        return existingTask;
      }

      // Taking or handing over a task changes who must consent to its
      // status, so only the people already involved may do it.
      if (actor.kind === "person") {
        const consent = decideConsent(
          "assign",
          await loadConsentFacts(tx, existingTask, actor),
        );
        if (consent.kind === "deny") throw consentError(consent);
      }

      if (nextAssigneeId) {
        await assertAssignableUser(
          nextAssigneeId,
          await getProjectWorkspaceId(existingTask.projectId, tx),
          existingTask.projectId,
          tx,
        );
      }

      const [updatedTask] = await tx
        .update(taskTable)
        .set({ userId: nextAssigneeId })
        .where(eq(taskTable.id, id))
        .returning();

      if (!updatedTask) {
        throw new HTTPException(500, {
          message: "Failed to update task assignee",
        });
      }

      return updatedTask;
    },
  );

  await publishTaskMutation(existingTask, updatedTask, currentUserId, {
    fields: ["userId"],
  });
  await notifyRemovedAssignee(existingTask, updatedTask, currentUserId);

  return updatedTask;
}

export default updateTaskAssignee;
