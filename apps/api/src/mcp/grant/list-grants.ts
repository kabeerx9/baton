import { and, desc, eq, gt, isNull } from "drizzle-orm";
import db from "../../database";
import { mcpGrantTable, workspaceTable } from "../../database/schema";

/** The caller's live grants, most recently used first. */
export async function listUserGrants(userId: string) {
  const rows = await db
    .select({
      id: mcpGrantTable.id,
      clientName: mcpGrantTable.clientName,
      workspaceId: workspaceTable.id,
      workspaceName: workspaceTable.name,
      createdAt: mcpGrantTable.createdAt,
      lastUsedAt: mcpGrantTable.lastUsedAt,
    })
    .from(mcpGrantTable)
    .leftJoin(
      workspaceTable,
      eq(workspaceTable.id, mcpGrantTable.defaultWorkspaceId),
    )
    .where(
      and(
        eq(mcpGrantTable.userId, userId),
        isNull(mcpGrantTable.revokedAt),
        gt(mcpGrantTable.idleExpiresAt, new Date()),
      ),
    )
    .orderBy(desc(mcpGrantTable.lastUsedAt), mcpGrantTable.id)
    .limit(200);
  return rows.map((row) => ({
    id: row.id,
    clientName: row.clientName,
    workspace:
      row.workspaceId && row.workspaceName
        ? { id: row.workspaceId, name: row.workspaceName }
        : null,
    createdAt: row.createdAt.toISOString(),
    lastUsedAt: row.lastUsedAt.toISOString(),
  }));
}
