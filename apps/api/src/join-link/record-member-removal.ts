import { and, eq, sql } from "drizzle-orm";
import { workspaceMemberRemovalTable } from "../database/schema";
import type { DbOrTx } from "../project-access/db-or-tx";

// Invariant: a removal row for (workspace, user) means the person's last
// exit from that workspace was a removal. A removal writes it; a voluntary
// leave deletes it. A removal that fails after writing it leaves a stale row
// only while the person is still a member, and their next leave clears it.

/**
 * Records that a person was removed from a workspace; a join link made
 * before this moment refuses them. Runs before or inside the member delete,
 * so no moment exists where the person is gone and an old link still admits
 * them. It throws on failure: the removal must fail with it.
 */
export async function recordMemberRemoval(
  database: DbOrTx,
  workspaceId: string,
  userId: string,
) {
  await database
    .insert(workspaceMemberRemovalTable)
    .values({ workspaceId, userId })
    .onConflictDoUpdate({
      target: [
        workspaceMemberRemovalTable.workspaceId,
        workspaceMemberRemovalTable.userId,
      ],
      set: { removedAt: sql`(now() AT TIME ZONE 'utc')` },
    });
}

/**
 * A voluntary leave is the person's last exit now, so links made before an
 * earlier removal admit them again. Called after the leave succeeds.
 */
export async function clearMemberRemoval(
  database: DbOrTx,
  workspaceId: string,
  userId: string,
) {
  await database
    .delete(workspaceMemberRemovalTable)
    .where(
      and(
        eq(workspaceMemberRemovalTable.workspaceId, workspaceId),
        eq(workspaceMemberRemovalTable.userId, userId),
      ),
    );
}
