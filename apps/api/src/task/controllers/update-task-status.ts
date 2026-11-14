import { HTTPException } from "hono/http-exception";
import { withLockedTask } from "./with-locked-task";
import type { taskTable } from "../../database/schema";
import { publishEvent } from "../../events";
import { publishTaskMutation } from "./task-mutation-effects";
import { personActor, type TaskActor } from "../../task-change-request/actor";
import { cancelPendingRequests } from "../../task-change-request/cancel-pending";
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
import {
  checkStatusChange,
  writeStatus,
} from "../../task-change-request/status-change";
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
  const { before: existingTask, after: result } = await withLockedTask(
    id,
    async (tx, existingTask): Promise<TaskStatusResult> => {
      if (actor.kind === "person" && status !== existingTask.status) {
        const facts = await loadConsentFacts(tx, existingTask, actor);
        const consent = decideConsent("status", facts);
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

      const check = await checkStatusChange(
        tx,
        existingTask,
        status,
        currentUserId,
      );
      if (!check.ok)
        throw new HTTPException(check.status, { message: check.message });
      if (status !== existingTask.status)
        effects.push(
          ...finishedEffects(
            await cancelPendingRequests(tx, id, "task_changed"),
            currentUserId,
          ),
        );
      const updatedTask = await writeStatus(tx, id, status, check.columnId);
      if (!updatedTask) {
        throw new HTTPException(500, {
          message: "Failed to update task status",
        });
      }
      return { outcome: "applied", task: updatedTask };
    },
  );

  await dispatchRequestEffects(effects);
  if (result.outcome === "requested") return result;
  const updatedTask = result.task;

  await publishTaskMutation(existingTask, updatedTask, currentUserId, {
    fields: ["status"],
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
