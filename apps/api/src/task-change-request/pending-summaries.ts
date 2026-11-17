import { and, eq, inArray } from "drizzle-orm";
import db from "../database";
import type { DbOrTx } from "../project-access/db-or-tx";
import { taskChangeRequestTable } from "../database/schema";
import type { PendingRequestSummary } from "./response";

const columns = {
  taskId: taskChangeRequestTable.taskId,
  id: taskChangeRequestTable.id,
  kind: taskChangeRequestTable.kind,
  targetStatus: taskChangeRequestTable.targetStatus,
  requestedBy: taskChangeRequestTable.requestedBy,
  channel: taskChangeRequestTable.channel,
  expiresAt: taskChangeRequestTable.expiresAt,
};

function toMap(
  rows: Array<{ taskId: string | null } & NonNullable<PendingRequestSummary>>,
) {
  const map = new Map<string, NonNullable<PendingRequestSummary>>();
  for (const { taskId, ...summary } of rows)
    if (taskId) map.set(taskId, summary);
  return map;
}

/**
 * Open requests for a whole workspace in one query, keyed by task. Callers
 * look up only tasks they already show, so nothing hidden leaks.
 */
export async function pendingRequestsInWorkspace(
  workspaceId: string,
  database: DbOrTx = db,
) {
  return toMap(
    await database
      .select(columns)
      .from(taskChangeRequestTable)
      .where(
        and(
          eq(taskChangeRequestTable.workspaceId, workspaceId),
          eq(taskChangeRequestTable.state, "pending"),
        ),
      ),
  );
}

export async function pendingRequestsForTasks(
  taskIds: string[],
  database: DbOrTx = db,
) {
  if (taskIds.length === 0) return toMap([]);
  return toMap(
    await database
      .select(columns)
      .from(taskChangeRequestTable)
      .where(
        and(
          inArray(taskChangeRequestTable.taskId, taskIds),
          eq(taskChangeRequestTable.state, "pending"),
        ),
      ),
  );
}
