import { and, eq, ne, sql } from "drizzle-orm";
import db from "../../database";
import { outboxTable } from "../../database/schema";

/**
 * The operator's requeue for a dead row, also as SQL:
 *
 *   UPDATE outbox SET state = 'pending', exempt_claims = attempts,
 *     next_attempt_at = (now() AT TIME ZONE 'utc')
 *   WHERE id = '<id>' AND state <> 'pending';
 *
 * It never resets `attempts`: that is the fence, and a relay that stalled
 * before the row died still holds an older value. Exempting every claim so
 * far gives the row a fresh failure budget instead.
 */
export async function requeueOutboxRow(id: string): Promise<boolean> {
  const rows = await db
    .update(outboxTable)
    .set({
      state: "pending",
      exemptClaims: sql`${outboxTable.attempts}`,
      nextAttemptAt: sql`(now() AT TIME ZONE 'utc')`,
    })
    .where(and(eq(outboxTable.id, id), ne(outboxTable.state, "pending")))
    .returning({ id: outboxTable.id });
  return rows.length > 0;
}
