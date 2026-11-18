import { and, eq, exists, sql } from "drizzle-orm";
import {
  workspaceMemberRemovalTable,
  workspaceUserTable,
} from "../database/schema";
import type { DbOrTx } from "../project-access/db-or-tx";

// Invariant: a removal row for (workspace, user) means the person's last
// exit from that workspace was a removal. Both exits change the row before
// they delete the member: a removal writes it, a voluntary leave deletes it.
// So a removal that starts after a leave's clear always leaves its row, and
// an exit that fails after its write only changes the row of a person who is
// still a member, which the next exit overwrites.

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
 * A voluntary leave is about to be the person's last exit, so links made
 * before an earlier removal admit them again. Called before the leave's
 * member delete. It clears the row only while the person is a member, so a
 * removed person cannot erase their removal by calling leave.
 */
export async function clearMemberRemoval(
  database: DbOrTx,
  workspaceId: string,
  userId: string,
) {
  const isMember = database
    .select({ one: sql`1` })
    .from(workspaceUserTable)
    .where(
      and(
        eq(workspaceUserTable.workspaceId, workspaceId),
        eq(workspaceUserTable.userId, userId),
      ),
    );
  await database
    .delete(workspaceMemberRemovalTable)
    .where(
      and(
        eq(workspaceMemberRemovalTable.workspaceId, workspaceId),
        eq(workspaceMemberRemovalTable.userId, userId),
        exists(isMember),
      ),
    );
}
