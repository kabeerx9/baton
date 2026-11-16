import { HTTPException } from "hono/http-exception";
import { withLockedProjectTask } from "./with-locked-task";
import type { taskTable } from "../../database/schema";
import { publishEvent } from "../../events";
import {
  enqueueTaskMutation,
  publishTaskMutation,
} from "./task-mutation-effects";
import { personActor, type TaskActor } from "../../task-change-request/actor";
import { applyTaskChange } from "../../task-change-request/apply-task-change";
import { decideConsent } from "../../task-change-request/consent";
import {
  dispatchRequestEffects,
  finishedEffects,
  type RequestEffect,
} from "../../task-change-request/effects";
import { loadConsentFacts } from "../../task-change-request/load-consent-facts";
import {
  consentError,
  openRequestWithEffects,
} from "../../task-change-request/request-change";
import type { ChangeRequestRow } from "../../task-change-request/response";
import { getValidTaskStatuses } from "../validate-task-fields";

type Task = typeof taskTable.$inferSelect;

export type TaskStatusResult =
  | { outcome: "applied"; task: Task }
  | { outcome: "requested"; request: ChangeRequestRow; task: Task };

/**
 * Sets a task's status. A person who is not involved in the task (not its
 * creator, assignee or a workspace admin) gets a change request instead.
 * The actor defaults to the current user as a person, so a caller that
 * forgets it is held to the consent rules rather than skipping them.
 */
async function updateTaskStatus({
  id,
  status,
  currentUserId,
  actor = personActor(currentUserId),
}: {
  id: string;
  status: string;
  currentUserId: string;
  actor?: TaskActor;
}): Promise<TaskStatusResult> {
  const effects: RequestEffect[] = [];
  const { before: existingTask, after: result } = await withLockedProjectTask(
    id,
    actor.kind === "person" ? actor.userId : null,
    async (tx, existingTask): Promise<TaskStatusResult> => {
      if (actor.kind === "person" && status !== existingTask.status) {
        const facts = await loadConsentFacts(tx, existingTask, actor);
        const consent = decideConsent("status", facts, {
          from: existingTask.status,
          to: status,
        });
        if (consent.kind === "deny") throw consentError(consent);
        if (consent.kind === "request") {
          const valid = await getValidTaskStatuses(existingTask.projectId, tx);
          if (!valid.includes(status))
            throw new HTTPException(400, {
              message: `Invalid status "${status}". Valid statuses for this project: ${valid.join(", ")}`,
            });
          const opened = await openRequestWithEffects(tx, {
            task: existingTask,
            workspaceId: facts.workspaceId,
            actor,
            kind: "status",
            targetStatus: status,
          });
          effects.push(...opened.effects);
          return {
            outcome: "requested",
            request: opened.request,
            task: existingTask,
          };
        }
      }

      const applied = await applyTaskChange(tx, actor, existingTask, {
        kind: "status",
        status,
      });
      if (!applied.ok)
        throw new HTTPException(applied.status, { message: applied.message });
      if (applied.kind !== "status")
        throw new HTTPException(500, {
          message: "Failed to update task status",
        });
      effects.push(...finishedEffects(applied.cancelled, currentUserId));
      const updatedTask = applied.after;
      // The activity row commits with the status write (no loss window).
      await enqueueTaskMutation(tx, existingTask, updatedTask, currentUserId, {
        fields: ["status"],
      });
      return { outcome: "applied", task: updatedTask };
    },
  );

  await dispatchRequestEffects(effects);
  if (result.outcome === "requested") return result;
  const updatedTask = result.task;

  await publishTaskMutation(existingTask, updatedTask, currentUserId, {
    fields: ["status"],
    enqueued: true,
  });

  if (
    existingTask.status === updatedTask.status &&
    existingTask.columnId !== updatedTask.columnId
  )
    await publishEvent("task.updated", {
      taskId: updatedTask.id,
      projectId: updatedTask.projectId,
      userId: currentUserId,
    });

  return result;
}

export default updateTaskStatus;
