import { and, eq, isNull, sql } from "drizzle-orm";
import db from "../../database";
import { workspaceTable, workspaceUserTable } from "../../database/schema";
import { workspaceAccessColumns } from "../can-read-workspace";
import { filterReadableWorkspaces } from "../filter-readable-workspaces";
import {
  toWorkspaceResponse,
  workspaceColumns,
} from "../to-workspace-response";

async function listWorkspaces(userId: string) {
  const sortName = sql`lower(${workspaceTable.name})`;

  const rows = await db
    .selectDistinctOn([sortName, workspaceTable.id], {
      ...workspaceColumns,
      ...workspaceAccessColumns,
    })
    .from(workspaceTable)
    .innerJoin(
      workspaceUserTable,
      and(
        eq(workspaceUserTable.workspaceId, workspaceTable.id),
        eq(workspaceUserTable.userId, userId),
      ),
    )
    // Demo workspaces are reached only through the tour, never a list.
    .where(
      and(isNull(workspaceTable.archivedAt), eq(workspaceTable.kind, "team")),
    )
    .orderBy(
      sortName,
      workspaceTable.id,
      workspaceUserTable.joinedAt,
      workspaceUserTable.id,
    );

  return (await filterReadableWorkspaces(rows)).map(toWorkspaceResponse);
}

export default listWorkspaces;
