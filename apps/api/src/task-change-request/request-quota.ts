import { sql } from "drizzle-orm";
import type { DbOrTx } from "../project-access/db-or-tx";

/**
 * Serializes one person's request quota in a workspace for the rest of the
 * transaction, so two requests on different tasks cannot both pass the
 * hourly count. Taken after the project lock and before the task lock.
 */
export async function lockRequestQuota(
  database: DbOrTx,
  workspaceId: string,
  userId: string,
) {
  await database.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${`task-change-request:${workspaceId}:${userId}`}, 0))`,
  );
}
