import { and, eq, isNull, sql } from "drizzle-orm";
import db from "../../database";
import { workspaceJoinLinkTable } from "../../database/schema";

/** Turns off the workspace's link. Idempotent; the row is kept. */
async function revokeJoinLink(workspaceId: string, userId: string) {
  await db
    .update(workspaceJoinLinkTable)
    .set({
      revokedAt: sql`(now() AT TIME ZONE 'utc')`,
      revokedBy: userId,
      tokenCiphertext: null,
    })
    .where(
      and(
        eq(workspaceJoinLinkTable.workspaceId, workspaceId),
        isNull(workspaceJoinLinkTable.revokedAt),
      ),
    );
  return { link: null };
}

export default revokeJoinLink;
