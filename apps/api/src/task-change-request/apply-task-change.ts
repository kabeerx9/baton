import { and, eq, type SQL, sql } from "drizzle-orm";
import { columnTable, taskTable } from "../database/schema";
import type { DbOrTx } from "../project-access/db-or-tx";
import { deleteLockedTask } from "../task/controllers/delete-task";
import type { TaskTransaction } from "../task/controllers/with-locked-task";
import { VIRTUAL_STATUSES } from "../task/validate-task-fields";
import type { TaskActor } from "./actor";
import { type CancelReason, cancelPendingRequests } from "./cancel-pending";
import type { ChangeRequestRow } from "./response";
import { checkStatusChange } from "./status-change";

type Task = typeof taskTable.$inferSelect;

/**
 * The SET fragment every status writer uses: the new status, and the status
 * generation bumped when the status really changes. Column references in an
 * UPDATE's SET read the row's old values.
 */
export function statusWrite(status: string | SQL) {
  return {
    status,
    statusGeneration: sql`case when ${taskTable.status} is distinct from ${status} then ${taskTable.statusGeneration} + 1 else ${taskTable.statusGeneration} end`,
  };
}

export type TaskChange =
  | { kind: "status"; status: string }
  | { kind: "delete" };

export type ApplyResult =
  | {
      ok: true;
      kind: "status";
      before: Task;
      after: Task;
      cancelled: ChangeRequestRow[];
    }
  | { ok: true; kind: "delete"; before: Task; cancelled: ChangeRequestRow[] }
  | { ok: false; status: 400 | 409; message: string };

/**
 * The one command for writing a task's status or deleting it, in the
 * caller's transaction. Consent is decided before this (authorize, then
 * apply). It validates, writes, and cancels any pending change request on
 * the task, so a stale request can never apply.
 *
 * Domain rules: a person's move into a final column is refused while the
 * task is blocked. System writers (GitHub webhooks, sync, replay, manual
 * import and resume) are a deliberate exception: GitHub is the source of
 * truth for what was merged or closed, so they skip the blocker check and a
 * status with no column is skipped instead of refused.
 *
 * The task row is written before the request rows are touched, so the lock
 * order stays task, then request, even for callers that did not lock first.
 */
export async function applyTaskChange(
  tx: TaskTransaction,
  actor: TaskActor,
  task: Task,
  change: TaskChange,
  reason: CancelReason = change.kind === "delete"
    ? "task_deleted"
    : "task_changed",
): Promise<ApplyResult> {
  if (change.kind === "delete") {
    const { deleted, cancelled } = await deleteLockedTask(tx, task);
    if (!deleted) return { ok: false, status: 409, message: "Task not found" };
    return { ok: true, kind: "delete", before: task, cancelled };
  }

  let columnId: string | null;
  if (actor.kind === "person") {
    const check = await checkStatusChange(
      tx,
      task,
      change.status,
      actor.userId,
    );
    if (!check.ok) return check;
    columnId = check.columnId;
  } else {
    const [column] = await tx
      .select({ id: columnTable.id })
      .from(columnTable)
      .where(
        and(
          eq(columnTable.projectId, task.projectId),
          eq(columnTable.slug, change.status),
        ),
      )
      .limit(1);
    if (
      !column &&
      !(VIRTUAL_STATUSES as readonly string[]).includes(change.status)
    )
      return {
        ok: false,
        status: 400,
        message: `Column "${change.status}" not found`,
      };
    columnId = column?.id ?? null;
  }

  const [after] = await tx
    .update(taskTable)
    .set({ ...statusWrite(change.status), columnId })
    .where(
      and(eq(taskTable.id, task.id), eq(taskTable.projectId, task.projectId)),
    )
    .returning();
  if (!after)
    return { ok: false, status: 409, message: "Task changed projects" };
  const cancelled =
    after.status !== task.status
      ? await cancelPendingRequests(tx, task.id, reason)
      : [];
  return { ok: true, kind: "status", before: task, after, cancelled };
}

/** For writers that changed status, repo or assignee outside the command. */
export async function cancelOnChange(
  database: DbOrTx,
  taskId: string,
  reason: CancelReason = "task_changed",
) {
  return cancelPendingRequests(database, taskId, reason);
}
