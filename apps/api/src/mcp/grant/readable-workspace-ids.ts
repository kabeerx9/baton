import { and, eq, inArray, isNull } from "drizzle-orm";
import db from "../../database";
import { workspaceTable, workspaceUserTable } from "../../database/schema";
import { workspaceAccessColumns } from "../../workspace/can-read-workspace";
import { filterReadableWorkspaces } from "../../workspace/filter-readable-workspaces";

/**
 * The subset of `workspaceIds` the user can read now, by the same policy as
 * the workspace list: a member, a team workspace, not archived, and `workspace:read`, which
 * every role a member holds grants. Instance admins get no bypass.
 */
export async function readableWorkspaceIds(
  userId: string,
  workspaceIds: string[],
): Promise<Set<string>> {
  if (workspaceIds.length === 0) return new Set();
  const rows = await db
    .select({ id: workspaceTable.id, ...workspaceAccessColumns })
    .from(workspaceTable)
    .innerJoin(
      workspaceUserTable,
      and(
        eq(workspaceUserTable.workspaceId, workspaceTable.id),
        eq(workspaceUserTable.userId, userId),
      ),
    )
    .where(
      and(
        inArray(workspaceTable.id, workspaceIds),
        isNull(workspaceTable.archivedAt),
        // An agent never gets a product-tour sandbox as its workspace.
        eq(workspaceTable.kind, "team"),
      ),
    );
  return new Set((await filterReadableWorkspaces(rows)).map((row) => row.id));
}
