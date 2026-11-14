import { eq, or } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  assetTable,
  taskRelationTable,
  taskTable,
} from "../../database/schema";
import { publishEvent } from "../../events";
import { queueStorageCleanup } from "../../storage/cleanup-queue";
import { personActor, type TaskActor } from "../../task-change-request/actor";
import { applyTaskChange } from "../../task-change-request/apply-task-change";
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
import type { TaskTransaction } from "./with-locked-task";
import getTask from "./get-task";

type Task = typeof taskTable.$inferSelect;

export type DeleteTaskResult =
  | { outcome: "applied"; task: Awaited<ReturnType<typeof getTask>> }
  | {
      outcome: "requested";
      request: ChangeRequestRow;
      task: Awaited<ReturnType<typeof getTask>>;
    };

/**
 * Deletes a locked task in the caller's transaction. Assets are queued for
 * cleanup in the same transaction, so nothing is removed before commit.
 * Pending requests on the task end as cancelled and keep their history.
 */
export async function deleteLockedTask(tx: TaskTransaction, task: Task) {
  const cancelled = await cancelPendingRequests(tx, task.id, "task_deleted");
  const assets = await tx
    .select({ objectKey: assetTable.objectKey })
    .from(assetTable)
    .where(eq(assetTable.taskId, task.id));
  await queueStorageCleanup(
    tx,
    assets.map((asset) => asset.objectKey),
  );
  const [deleted] = await tx
    .delete(taskTable)
    .where(eq(taskTable.id, task.id))
    .returning();
  return { deleted, cancelled };
}

export async function taskRelationsOf(taskId: string) {
  return db
    .select()
    .from(taskRelationTable)
    .where(
      or(
        eq(taskRelationTable.sourceTaskId, taskId),
        eq(taskRelationTable.targetTaskId, taskId),
      ),
    )
    .execute();
}

export async function publishTaskDeleted(
  task: { id: string; projectId: string; title: string },
  relations: (typeof taskRelationTable.$inferSelect)[],
  userId: string | null,
) {
  await publishEvent("task.deleted", {
    taskId: task.id,
    projectId: task.projectId,
    userId,
    title: task.title,
  });

  for (const relation of relations) {
    await publishEvent("task-relation.deleted", {
      projectId: task.projectId,
      userId,
      taskId: task.id,
      sourceTaskId: relation.sourceTaskId,
      targetTaskId: relation.targetTaskId,
    });
  }
}

async function deleteTask(
  taskId: string,
  currentUserId: string,
  actor: TaskActor = personActor(currentUserId),
): Promise<DeleteTaskResult> {
  const task = await getTask(taskId);
  const relations = await taskRelationsOf(taskId);
  const effects: RequestEffect[] = [];

  const result = await db.transaction(async (tx) => {
    const [locked] = await tx
      .select()
      .from(taskTable)
      .where(eq(taskTable.id, taskId))
      .for("update");
    if (!locked) throw new HTTPException(404, { message: "Task not found" });
    if (locked.projectId !== task.projectId)
      throw new HTTPException(409, {
        message: "Task changed projects; retry the operation",
      });
    if (actor.kind === "person") {
      const facts = await loadConsentFacts(tx, locked, actor);
      const consent = decideConsent("delete", facts);
      if (consent.kind === "deny") throw consentError(consent);
      if (consent.kind === "request") {
        const opened = await openRequestWithEffects(tx, {
          task: locked,
          workspaceId: facts.workspaceId,
          actor,
          kind: "delete",
          targetStatus: null,
        });
        effects.push(...opened.effects);
        return { kind: "requested" as const, request: opened.request };
      }
    }
    const applied = await applyTaskChange(tx, actor, locked, {
      kind: "delete",
    });
    if (!applied.ok)
      throw new HTTPException(applied.status, { message: applied.message });
    effects.push(...finishedEffects(applied.cancelled, currentUserId));
    return { kind: "deleted" as const, deleted: applied.before };
  });

  await dispatchRequestEffects(effects);
  if (result.kind === "requested")
    return { outcome: "requested", request: result.request, task };

  if (!result.deleted) {
    throw new HTTPException(404, {
      message: "Task not found",
    });
  }

  await publishTaskDeleted(task, relations, currentUserId);
  return { outcome: "applied", task };
}

export default deleteTask;
