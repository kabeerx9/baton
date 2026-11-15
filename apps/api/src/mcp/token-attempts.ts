import { sql } from "drizzle-orm";
import db from "../database";
import { mcpOauthStateTable } from "../database/schema";

export const TOKEN_ATTEMPTS_PER_MINUTE = 30;

/**
 * Count one /token attempt for a registered client. Returns false once the
 * client used its attempts for this minute. Unknown clients are not counted:
 * they create no rows and fail on the grant checks anyway. The counter row
 * expires, so the existing sweep removes it; it is shared by every replica.
 */
export async function takeTokenAttempt(clientId: string): Promise<boolean> {
  const t = mcpOauthStateTable;
  const now = sql`(now() AT TIME ZONE 'UTC')`;
  const windowEnd = sql`(now() AT TIME ZONE 'UTC') + interval '1 minute'`;
  const result = await db.execute<{ count: number }>(sql`
    INSERT INTO ${t} (id, kind, key, payload, expires_at)
    SELECT ${crypto.randomUUID()}, 'token_rate', ${clientId}, '{"count":1}'::jsonb, ${windowEnd}
    WHERE EXISTS (
      SELECT 1 FROM ${t} WHERE kind = 'client' AND key = ${clientId} AND expires_at > ${now}
    )
    ON CONFLICT (kind, key) DO UPDATE SET
      payload = jsonb_build_object('count', CASE
        WHEN ${t}.expires_at <= ${now} THEN 1
        ELSE coalesce((${t}.payload->>'count')::integer, 0) + 1 END),
      expires_at = CASE WHEN ${t}.expires_at <= ${now} THEN ${windowEnd} ELSE ${t}.expires_at END,
      updated_at = ${now}
    RETURNING (payload->>'count')::integer AS count
  `);
  const count = result.rows[0]?.count;
  return count === undefined || count <= TOKEN_ATTEMPTS_PER_MINUTE;
}
