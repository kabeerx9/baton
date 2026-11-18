import { sql } from "drizzle-orm";
import db from "../database";
import { slackUserLinkTable, userTable } from "../database/schema";

/**
 * Marks one user's digest as sent for a local day, in one statement. It
 * claims only when both hold:
 * - the user's stored zone is still `storedZone`, the value the tick
 *   computed `day` from. A zone change after the tick's selection makes the
 *   claim skip, and the next tick recomputes with the new zone.
 * - `day` is later than the last day claimed. A restart, a second server, or
 *   a zone change that moves the local day back cannot send a second digest.
 *
 * At most once: the claim commits before the Slack call, and a failed send
 * is not retried.
 */
export async function claimDigest(
  userId: string,
  day: string,
  storedZone: string | null,
) {
  const claimed = await db.execute<{ user_id: string }>(sql`
    insert into ${slackUserLinkTable} (user_id, last_digest_day)
    select ${userTable.id}, ${day}::text from ${userTable}
    where ${userTable.id} = ${userId}
      and ${userTable.timeZone} is not distinct from ${storedZone}::text
    on conflict (user_id) do update set last_digest_day = excluded.last_digest_day
    where ${slackUserLinkTable.lastDigestDay} is null
      or ${slackUserLinkTable.lastDigestDay} < excluded.last_digest_day
    returning user_id
  `);
  return claimed.rows.length > 0;
}
