import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { schema } from "../../database";
import type { DbOrTx } from "../../project-access/db-or-tx";

/**
 * Locks a workspace row for a lifecycle change and returns what it needs.
 * A demo workspace is not found here unless the caller is its member path
 * (`allowDemo`): administrators never archive, restore or delete one.
 */
export async function lockWorkspaceRow(
  database: DbOrTx,
  workspaceId: string,
  { allowDemo = false }: { allowDemo?: boolean } = {},
) {
  const [workspace] = await database
    .select()
    .from(schema.workspaceTable)
    .where(
      and(
        eq(schema.workspaceTable.id, workspaceId),
        allowDemo ? undefined : eq(schema.workspaceTable.kind, "team"),
      ),
    )
    .for("update");
  if (!workspace) {
    throw new HTTPException(404, { message: "Workspace not found" });
  }
  return workspace;
}
