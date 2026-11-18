import { sql } from "drizzle-orm";
import { workspaceMemberRemovalTable } from "../database/schema";
import type { DbOrTx } from "../project-access/db-or-tx";

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
