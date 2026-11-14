import { and, eq, sql } from "drizzle-orm";
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
