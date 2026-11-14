import { eq } from "drizzle-orm";
import { schema } from "../database";
import type { DbOrTx } from "../project-access/db-or-tx";

/**
 * The first lock on every path that opens, accepts or times out a change
 * request. Workspace archive and delete lock the workspace row FOR UPDATE
 * and then cascade into projects, tasks and requests, so these paths take
 * the workspace row FOR SHARE before any project, quota, task or request
 * lock. Rows are locked in id order. Returns the ids that still exist.
 */
export async function lockWorkspacesShared(
  database: DbOrTx,
  workspaceIds: (string | null | undefined)[],
) {
  const ids = [
    ...new Set(workspaceIds.filter((id): id is string => Boolean(id))),
  ].sort();
  const found = new Set<string>();
  for (const id of ids) {
    const [row] = await database
      .select({ id: schema.workspaceTable.id })
      .from(schema.workspaceTable)
      .where(eq(schema.workspaceTable.id, id))
      .for("share");
    if (row) found.add(row.id);
  }
  return found;
}

/** The workspace of a task's current project, read without locks. */
export async function taskWorkspaceId(database: DbOrTx, taskId: string) {
  const [row] = await database
    .select({
      projectId: schema.taskTable.projectId,
      workspaceId: schema.projectTable.workspaceId,
    })
    .from(schema.taskTable)
    .innerJoin(
      schema.projectTable,
      eq(schema.projectTable.id, schema.taskTable.projectId),
    )
    .where(eq(schema.taskTable.id, taskId))
    .limit(1);
  return row;
}
