import { and, eq, inArray, sql } from "drizzle-orm";
import { taskChangeRequestTable } from "../database/schema";
import type { DbOrTx } from "../project-access/db-or-tx";

export type CancelReason =
  | "withdrawn"
  | "task_changed"
  | "task_deleted"
  | "became_feature"
  | "requester_lost_access"
  | "refused";

/**
 * Cancels the pending request on a task, in the caller's transaction, and
 * returns it so the requester can be told after commit. The database
 * triggers cancel on any status, repo or assignee change as well; calling
 * this first records a precise reason and lets the caller notify.
 */
export async function cancelPendingRequests(
  database: DbOrTx,
  taskId: string,
  reason: CancelReason,
) {
  return database
    .update(taskChangeRequestTable)
    .set({
      state: "cancelled",
      reason,
      decidedAt: sql`(now() AT TIME ZONE 'utc')`,
    })
    .where(
      and(
        eq(taskChangeRequestTable.taskId, taskId),
        eq(taskChangeRequestTable.state, "pending"),
      ),
    )
    .returning();
}

/** The same, for many tasks at once (bulk unassignment, project changes). */
export async function cancelPendingRequestsFor(
  database: DbOrTx,
  taskIds: string[],
  reason: CancelReason,
) {
  if (taskIds.length === 0) return [];
  return database
    .update(taskChangeRequestTable)
    .set({
      state: "cancelled",
      reason,
      decidedAt: sql`(now() AT TIME ZONE 'utc')`,
    })
    .where(
      and(
        inArray(taskChangeRequestTable.taskId, taskIds),
        eq(taskChangeRequestTable.state, "pending"),
      ),
    )
    .returning();
}

/** Every pending request on a repo's tasks: the repo moved or was deleted. */
export async function cancelPendingRequestsInProject(
  database: DbOrTx,
  projectId: string,
  reason: CancelReason,
) {
  return database
    .update(taskChangeRequestTable)
    .set({
      state: "cancelled",
      reason,
      decidedAt: sql`(now() AT TIME ZONE 'utc')`,
    })
    .where(
      and(
        eq(taskChangeRequestTable.projectId, projectId),
        eq(taskChangeRequestTable.state, "pending"),
      ),
    )
    .returning();
}
