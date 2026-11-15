import { and, eq, inArray, isNull } from "drizzle-orm";
import db from "../../database";
import { mcpGrantTable, mcpTokenTable } from "../../database/schema";
import type { DbOrTx } from "../../project-access/db-or-tx";

async function endGrants(
  tx: DbOrTx,
  where: ReturnType<typeof and>,
): Promise<string[]> {
  const revoked = await tx
    .update(mcpGrantTable)
    .set({ revokedAt: new Date() })
    .where(and(where, isNull(mcpGrantTable.revokedAt)))
    .returning({ id: mcpGrantTable.id });
  const ids = revoked.map((row) => row.id);
  if (ids.length) {
    await tx.delete(mcpTokenTable).where(inArray(mcpTokenTable.grantId, ids));
  }
  return ids;
}

/** Revoke one grant and delete its tokens. Postgres is the authority, so every replica sees it on the next call. */
export function revokeGrant(tx: DbOrTx, grantId: string) {
  return endGrants(tx, and(eq(mcpGrantTable.id, grantId)));
}

/** Revoke one of the caller's grants. Returns false when it is not theirs or already revoked. */
export async function revokeOwnGrant(userId: string, grantId: string) {
  const ids = await db.transaction((tx) =>
    endGrants(
      tx,
      and(eq(mcpGrantTable.id, grantId), eq(mcpGrantTable.userId, userId)),
    ),
  );
  return ids.length > 0;
}

/** Ban, deactivation and password reset disconnect every agent of the user. */
export function revokeUserGrants(userId: string, tx: DbOrTx = db) {
  return endGrants(tx, and(eq(mcpGrantTable.userId, userId)));
}
