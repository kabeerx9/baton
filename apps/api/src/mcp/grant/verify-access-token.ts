import { and, eq, isNull, lt } from "drizzle-orm";
import db from "../../database";
import { mcpGrantTable, mcpTokenTable, userTable } from "../../database/schema";
import { isBanActive } from "../../utils/user-ban";
import { GRANT_IDLE_MS, LAST_USED_WRITE_INTERVAL_MS } from "./constants";
import { grantState } from "./grant-state";
import { hashMcpToken, isMcpTokenOfKind } from "./token-secret";

export type McpGrantPrincipal = {
  userId: string;
  grantId: string;
  resource: string;
  defaultWorkspaceId: string | null;
};

/**
 * Resolve an MCP access token to its grant, or null. One indexed read per call;
 * a revoked grant, an idle grant or a banned owner fails on any replica.
 */
export async function verifyAccessToken(
  token: string,
): Promise<McpGrantPrincipal | null> {
  if (!isMcpTokenOfKind(token, "access")) return null;
  const [row] = await db
    .select({
      expiresAt: mcpTokenTable.expiresAt,
      grantId: mcpGrantTable.id,
      userId: mcpGrantTable.userId,
      resource: mcpGrantTable.resource,
      defaultWorkspaceId: mcpGrantTable.defaultWorkspaceId,
      revokedAt: mcpGrantTable.revokedAt,
      idleExpiresAt: mcpGrantTable.idleExpiresAt,
      lastUsedAt: mcpGrantTable.lastUsedAt,
      banned: userTable.banned,
      banExpires: userTable.banExpires,
    })
    .from(mcpTokenTable)
    .innerJoin(mcpGrantTable, eq(mcpGrantTable.id, mcpTokenTable.grantId))
    .innerJoin(userTable, eq(userTable.id, mcpGrantTable.userId))
    .where(
      and(
        eq(mcpTokenTable.tokenHash, hashMcpToken(token)),
        eq(mcpTokenTable.kind, "access"),
      ),
    )
    .limit(1);
  const now = new Date();
  if (!row || !(row.expiresAt.getTime() > now.getTime())) return null;
  if (grantState(row, now).kind !== "active") return null;
  if (isBanActive(row)) return null;

  if (now.getTime() - row.lastUsedAt.getTime() > LAST_USED_WRITE_INTERVAL_MS) {
    await db
      .update(mcpGrantTable)
      .set({
        lastUsedAt: now,
        idleExpiresAt: new Date(now.getTime() + GRANT_IDLE_MS),
      })
      .where(
        and(
          eq(mcpGrantTable.id, row.grantId),
          isNull(mcpGrantTable.revokedAt),
          // Concurrent calls race to one write per interval.
          lt(
            mcpGrantTable.lastUsedAt,
            new Date(now.getTime() - LAST_USED_WRITE_INTERVAL_MS),
          ),
        ),
      );
  }
  return {
    userId: row.userId,
    grantId: row.grantId,
    resource: row.resource,
    defaultWorkspaceId: row.defaultWorkspaceId,
  };
}
