import { and, desc, eq, gt, isNull, lt, or } from "drizzle-orm";
import db from "../../database";
import { mcpGrantTable, workspaceTable } from "../../database/schema";
import { encodeGrantCursor, type GrantCursor } from "./grant-cursor";
import { readableWorkspaceIds } from "./readable-workspace-ids";

export const GRANT_PAGE_DEFAULT = 50;
export const GRANT_PAGE_MAX = 100;

/**
 * One page of the caller's live grants, newest first. Creation time never
 * changes, so paging cannot skip or repeat a grant. `nextCursor` is null on
 * the last page.
 */
export async function listUserGrants(
  userId: string,
  page: { limit?: number; cursor?: GrantCursor | null } = {},
) {
  const limit = Math.min(page.limit ?? GRANT_PAGE_DEFAULT, GRANT_PAGE_MAX);
  const after = page.cursor;
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
        after
          ? or(
              lt(mcpGrantTable.createdAt, after.createdAt),
              and(
                eq(mcpGrantTable.createdAt, after.createdAt),
                lt(mcpGrantTable.id, after.id),
              ),
            )
          : undefined,
      ),
    )
    .orderBy(desc(mcpGrantTable.createdAt), desc(mcpGrantTable.id))
    .limit(limit + 1);

  const pageRows = rows.slice(0, limit);
  const last = pageRows.at(-1);
  // The grant keeps its default after the user loses access; hide it then.
  const readable = await readableWorkspaceIds(userId, [
    ...new Set(pageRows.flatMap((row) => row.workspaceId ?? [])),
  ]);
  return {
    grants: pageRows.map((row) => ({
      id: row.id,
      clientName: row.clientName,
      workspace:
        row.workspaceId && row.workspaceName && readable.has(row.workspaceId)
          ? { id: row.workspaceId, name: row.workspaceName }
          : null,
      createdAt: row.createdAt.toISOString(),
      lastUsedAt: row.lastUsedAt.toISOString(),
    })),
    nextCursor:
      rows.length > limit && last
        ? encodeGrantCursor({ createdAt: last.createdAt, id: last.id })
        : null,
  };
}
