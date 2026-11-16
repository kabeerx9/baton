import { and, eq, gt, lte, ne, sql } from "drizzle-orm";
import db from "../../database";
import { outboxTable } from "../../database/schema";

const WINDOW = sql`(now() AT TIME ZONE 'utc') - interval '5 minutes'`;

/**
 * Degraded when a pending row has been due and unclaimed for 5 minutes
 * (a stopped relay, or a consumer no lane runs) or a row died in the last
 * 5 minutes. Reports counts only; never payloads.
 */
export async function checkOutboxHealth() {
  const [counts] = await db
    .select({
      stuck: sql<number>`count(*) FILTER (WHERE ${and(eq(outboxTable.state, "pending"), lte(outboxTable.nextAttemptAt, WINDOW))})::int`,
      newDead: sql<number>`count(*) FILTER (WHERE ${and(ne(outboxTable.state, "pending"), gt(outboxTable.nextAttemptAt, WINDOW))})::int`,
    })
    .from(outboxTable);
  const stuck = Number(counts?.stuck ?? 0);
  const newDead = Number(counts?.newDead ?? 0);
  const degraded = stuck > 0 || newDead > 0;
  if (degraded)
    console.error("Outbox is degraded", {
      stuck,
      newDead,
      // Never reset attempts: it is the fence (see requeue.ts).
      requeue:
        "UPDATE outbox SET state = 'pending', exempt_claims = attempts, next_attempt_at = (now() AT TIME ZONE 'utc') WHERE id = '<id>' AND state <> 'pending'",
    });
  return { degraded, stuck, newDead };
}
