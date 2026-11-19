import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { workspaceTable, workspaceUserTable } from "../../database/schema";
import { workspaceArchivedError } from "../archive/workspace-archived-error";
import { workspaceAccessColumns } from "../can-read-workspace";
import { filterReadableWorkspaces } from "../filter-readable-workspaces";
import {
  toWorkspaceResponse,
  workspaceColumns,
} from "../to-workspace-response";

async function getWorkspace(workspaceId: string, userId: string) {
  const rows = await db
    .select({
      ...workspaceColumns,
      ...workspaceAccessColumns,
      archivedAt: workspaceTable.archivedAt,
    })
    .from(workspaceTable)
    // Members only: an instance administrator who is not one gets 404.
    .innerJoin(
      workspaceUserTable,
      and(
        eq(workspaceUserTable.workspaceId, workspaceTable.id),
        eq(workspaceUserTable.userId, userId),
      ),
    )
    .where(eq(workspaceTable.id, workspaceId))
    .orderBy(workspaceUserTable.joinedAt, workspaceUserTable.id)
    .limit(1);

  const [row] = await filterReadableWorkspaces(rows);
  if (!row) {
    throw new HTTPException(404, { message: "Workspace not found" });
  }
  if (row.archivedAt) {
    throw workspaceArchivedError();
  }

  return toWorkspaceResponse(row);
}

export default getWorkspace;
