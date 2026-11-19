import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../database";
import {
  taskChangeRequestTable,
  type taskTable,
  workspaceTable,
} from "../database/schema";
import { ApiError } from "../errors/api-error";
import { publishEvent } from "../events";
import {
  publishTaskDeleted,
  taskRelationsOf,
} from "../task/controllers/delete-task";
import { publishTaskMutation } from "../task/controllers/task-mutation-effects";
import { lockTask } from "../task/controllers/with-locked-task";
import type { PersonActor } from "./actor";
import { decideAnswer } from "./consent";
import { dispatchRequestEffects, type RequestEffect } from "./effects";
import {
  type Decider,
  type Execution,
  executeChangeRequest,
  markRequest,
} from "./execute-change-request";
import { type RequestEvent, transition } from "./lifecycle";
import { lockWorkspacesShared, taskWorkspaceId } from "./lock-workspaces";
import {
  canSeeTaskProject,
  consentFactsWith,
  loadPersonGrants,
  projectWorkspaceId,
} from "./load-consent-facts";
import type { ChangeRequestRow } from "./response";
import { recordDomainEvent } from "../observability/domain-event";

type Task = typeof taskTable.$inferSelect;
export type Decision = "accept" | "reject" | "cancel";

const EVENTS: Record<Decision, RequestEvent> = {
  accept: { type: "accept" },
  reject: { type: "reject" },
  cancel: { type: "cancel" },
};

export async function findChangeRequest(id: string) {
  const [row] = await db
    .select()
    .from(taskChangeRequestTable)
    .where(eq(taskChangeRequestTable.id, id))
    .limit(1);
  return row;
}

/** Publishes the task events an applied request owes, after commit. */
export async function publishExecution(
  execution: Execution,
  actorId: string | null,
  relations: Awaited<ReturnType<typeof taskRelationsOf>>,
) {
  if (execution.kind === "applied") {
    await publishTaskMutation(
      execution.before,
      execution.after,
      actorId ?? undefined,
      {
        fields: ["status"],
      },
    );
    if (
      execution.before.status === execution.after.status &&
      execution.before.columnId !== execution.after.columnId
    )
      await publishEvent("task.updated", {
        taskId: execution.after.id,
        projectId: execution.after.projectId,
        userId: actorId,
      });
  } else if (execution.kind === "deleted") {
    await publishTaskDeleted(execution.before, relations, actorId);
  }
}

/**
 * Whether the caller may see the task as it is now. Reading a request's
 * history does not grant this: a requester or decider who lost access gets
 * the request back without the task. The task's current workspace may
 * differ from the request's after a project move; it must be active, as
 * for any task read.
 */
async function canReadTask(
  database: Parameters<typeof projectWorkspaceId>[0],
  actor: PersonActor,
  task: Task,
) {
  const workspaceId = await projectWorkspaceId(database, task.projectId);
  if (!workspaceId) return false;
  const [workspace] = await database
    .select({ archivedAt: workspaceTable.archivedAt })
    .from(workspaceTable)
    .where(eq(workspaceTable.id, workspaceId))
    .limit(1);
  if (!workspace || workspace.archivedAt) return false;
  const grants = await loadPersonGrants(database, workspaceId, actor);
  return (
    grants.member &&
    grants.can({ task: ["read"] }) &&
    (await canSeeTaskProject(database, actor.userId, task.projectId))
  );
}

/**
 * Accept, reject or withdraw a request. Lock order: the request's
 * workspace and the task's current one (FOR SHARE, by id), the task, then
 * the request. Only the person who recorded a decision may repeat it and
 * get the recorded outcome back; anyone else, or a different decision, gets
 * a 409. A refused accept (stale task, blocked, lost
 * access) still commits: the request ends cancelled with the reason.
 */
export async function decideChangeRequest({
  requestId,
  actor,
  decision,
}: {
  requestId: string;
  actor: PersonActor;
  decision: Decision;
}): Promise<{ request: ChangeRequestRow; task: Task | null }> {
  const found = await findChangeRequest(requestId);
  if (!found) throw new HTTPException(404, { message: "Request not found" });
  const relations =
    decision === "accept" && found.kind === "delete" && found.taskId
      ? await taskRelationsOf(found.taskId)
      : [];
  const decider: Decider = { userId: actor.userId, channel: actor.channel };
  const effects: RequestEffect[] = [];
  const done: { execution: Execution | null } = { execution: null };

  const result = await db.transaction(async (tx) => {
    const current = found.taskId
      ? await taskWorkspaceId(tx, found.taskId)
      : undefined;
    await lockWorkspacesShared(tx, [found.workspaceId, current?.workspaceId]);
    const outcome = await decideLocked(tx);
    return {
      request: outcome.request,
      task:
        outcome.task && (await canReadTask(tx, actor, outcome.task))
          ? outcome.task
          : null,
    };
  });

  async function decideLocked(
    tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  ): Promise<{ request: ChangeRequestRow; task: Task | null }> {
    const taskId = found?.taskId;
    const task = taskId ? ((await lockTask(tx, taskId)) ?? null) : null;
    const [request] = await tx
      .select()
      .from(taskChangeRequestTable)
      .where(eq(taskChangeRequestTable.id, requestId))
      .for("update");
    if (!request)
      throw new HTTPException(404, { message: "Request not found" });

    const step = transition(request.state, EVENTS[decision]);
    if (step.kind === "replay" && request.decidedBy === actor.userId)
      return { request, task };
    if (step.kind !== "move")
      throw new ApiError(409, {
        message: `This request is already ${request.state.replaceAll("_", " ")}.`,
        code: "REQUEST_DECIDED",
      });

    if (decision === "cancel") {
      if (request.requestedBy !== actor.userId)
        throw new ApiError(403, {
          message: "Only the person who made the request can withdraw it.",
          code: "NOT_REQUESTER",
        });
      const cancelled = await markRequest(
        tx,
        request.id,
        "cancelled",
        decider,
        "withdrawn",
      );
      effects.push({
        type: "finished",
        request: cancelled,
        actorId: actor.userId,
      });
      return { request: cancelled, task };
    }

    if (!task) {
      // The task is gone. Deleting it cancels its pending request in the
      // same transaction, so this only covers a row left pending by hand.
      const cancelled = await markRequest(
        tx,
        request.id,
        "cancelled",
        decider,
        "task_deleted",
      );
      effects.push({
        type: "finished",
        request: cancelled,
        actorId: actor.userId,
      });
      return { request: cancelled, task };
    }

    const kind = request.kind === "delete" ? "delete" : "status";
    const grants = await loadPersonGrants(tx, request.workspaceId, actor);
    const facts = await consentFactsWith(tx, task, actor.userId, grants);
    const answer = decideAnswer(kind, {
      ...facts,
      isRequester: request.requestedBy === actor.userId,
    });
    if (!answer.ok)
      throw new ApiError(403, {
        message: answer.message,
        code: "CANNOT_ANSWER",
      });

    if (decision === "reject") {
      const rejected = await markRequest(tx, request.id, "rejected", decider);
      effects.push({
        type: "finished",
        request: rejected,
        actorId: actor.userId,
      });
      return { request: rejected, task };
    }

    const execution = await executeChangeRequest(
      tx,
      request,
      task,
      "accepted",
      decider,
    );
    done.execution = execution;
    effects.push({
      type: "finished",
      request: execution.request,
      actorId: actor.userId,
    });
    return {
      request: execution.request,
      task:
        execution.kind === "applied"
          ? execution.after
          : execution.kind === "deleted"
            ? null
            : task,
    };
  }

  recordDomainEvent("change_request", "Change request decided", {
    change_request_id: requestId,
    decision,
    state: result.request.state,
  });
  if (done.execution)
    await publishExecution(done.execution, actor.userId, relations);
  await dispatchRequestEffects(effects);
  return result;
}
