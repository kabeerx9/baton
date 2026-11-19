import { eq } from "drizzle-orm";
import db, { schema } from "../../database";
import type { DbOrTx } from "../../project-access/db-or-tx";

/**
 * Everyone who may hold a realtime connection to the workspace: its members.
 * Instance administrators hold none unless they are members.
 */
export async function listWorkspaceAudience(
  workspaceId: string,
  database: DbOrTx = db,
) {
  const members = await database
    .select({ userId: schema.workspaceUserTable.userId })
    .from(schema.workspaceUserTable)
    .where(eq(schema.workspaceUserTable.workspaceId, workspaceId));
  return [...new Set(members.map((row) => row.userId))];
}
