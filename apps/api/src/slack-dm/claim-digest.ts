import { sql } from "drizzle-orm";
import db from "../database";
import { slackUserLinkTable } from "../database/schema";

/**
 * Marks one user's digest as sent for a local day. Returns false unless the
 * day is later than the last one claimed, so a restart, a second server, or a
 * zone change that moves the local day back cannot send a second digest.
 */
export async function claimDigest(userId: string, day: string) {
  const claimed = await db
    .insert(slackUserLinkTable)
    .values({ userId, lastDigestDay: day })
    .onConflictDoUpdate({
      target: slackUserLinkTable.userId,
      set: { lastDigestDay: day },
      setWhere: sql`${slackUserLinkTable.lastDigestDay} is null or ${slackUserLinkTable.lastDigestDay} < ${day}`,
    })
    .returning({ userId: slackUserLinkTable.userId });
  return claimed.length > 0;
}
