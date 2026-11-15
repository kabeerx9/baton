import { and, eq, lt } from "drizzle-orm";
import db from "../../database";
import { mcpGrantTable, mcpTokenTable, userTable } from "../../database/schema";
import { notBannedCondition } from "../../utils/user-ban";
import { keepClientAlive } from "../oauth";
import { GRANT_IDLE_MS } from "./constants";
import { issueTokenPair, type McpTokenPair } from "./issue-tokens";
import { decideRefresh } from "./refresh-decision";
import { revokeGrant } from "./revoke-grants";
import { hashMcpToken, isMcpTokenOfKind } from "./token-secret";

export type RefreshResult =
  | { kind: "issued"; tokens: McpTokenPair }
  | { kind: "invalid_grant" };

const invalid: RefreshResult = { kind: "invalid_grant" };

/**
 * Exchange a refresh token for a new pair. The grant row lock serializes
 * parallel refreshes, revocation and reuse detection on every replica.
 */
export async function refreshGrant(
  refreshToken: string,
  clientId: string,
): Promise<RefreshResult> {
  if (!isMcpTokenOfKind(refreshToken, "refresh")) return invalid;
  const tokenHash = hashMcpToken(refreshToken);
  return db.transaction(async (tx) => {
    const [found] = await tx
      .select({ grantId: mcpTokenTable.grantId })
      .from(mcpTokenTable)
      .where(
        and(
          eq(mcpTokenTable.tokenHash, tokenHash),
          eq(mcpTokenTable.kind, "refresh"),
        ),
      )
      .limit(1);
    if (!found) return invalid;

    // Lock order: grant, then token. Revocation takes the grant row first too.
    const [grant] = await tx
      .select()
      .from(mcpGrantTable)
      .where(eq(mcpGrantTable.id, found.grantId))
      .limit(1)
      .for("update");
    if (!grant || grant.clientId !== clientId) return invalid;
    const [token] = await tx
      .select()
      .from(mcpTokenTable)
      .where(eq(mcpTokenTable.tokenHash, tokenHash))
      .limit(1)
      .for("update");
    if (!token) return invalid;
    const [owner] = await tx
      .select({ id: userTable.id })
      .from(userTable)
      .where(and(eq(userTable.id, grant.userId), notBannedCondition()))
      .limit(1);
    if (!owner) return invalid;

    const now = new Date();
    const decision = decideRefresh({ grant, token, now });
    switch (decision.kind) {
      case "revoke":
        // Commit the revocation; the caller still gets invalid_grant.
        await revokeGrant(tx, grant.id);
        return invalid;
      case "reject":
        return invalid;
      case "rotate":
      case "grace": {
        if (decision.kind === "rotate") {
          await tx
            .update(mcpTokenTable)
            .set({ rotatedAt: now })
            .where(eq(mcpTokenTable.id, token.id));
        }
        const idleExpiresAt = new Date(now.getTime() + GRANT_IDLE_MS);
        await tx
          .update(mcpGrantTable)
          .set({ lastUsedAt: now, idleExpiresAt })
          .where(eq(mcpGrantTable.id, grant.id));
        // Delete only expired rows. A rotated refresh token stays until its
        // own expiry, so a replay at any point before then revokes the grant.
        await tx
          .delete(mcpTokenTable)
          .where(
            and(
              eq(mcpTokenTable.grantId, grant.id),
              lt(mcpTokenTable.expiresAt, now),
            ),
          );
        await keepClientAlive(tx, grant.clientId, idleExpiresAt);
        return {
          kind: "issued",
          tokens: await issueTokenPair(tx, grant.id, now),
        };
      }
    }
  });
}
