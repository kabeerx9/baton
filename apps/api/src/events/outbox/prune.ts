import { and, inArray, lt, ne, sql } from "drizzle-orm";
import db from "../../database";
import { outboxTable } from "../../database/schema";
import { withJobLease } from "../../scheduler/leader-lock";

export const DEAD_RETENTION_DAYS = 30;
const BATCH = 1_000;

/** Deletes dead rows 30 days after they died (their `next_attempt_at`). */
export async function pruneDeadOutboxRows(): Promise<{ deleted: number }> {
  let deleted = 0;
  for (;;) {
    const old = db
      .select({ id: outboxTable.id })
      .from(outboxTable)
      .where(
        and(
          ne(outboxTable.state, "pending"),
          lt(
            outboxTable.nextAttemptAt,
            sql`(now() AT TIME ZONE 'utc') - ${DEAD_RETENTION_DAYS} * interval '1 day'`,
          ),
        ),
      )
      .limit(BATCH);
    const rows = await db
      .delete(outboxTable)
      .where(inArray(outboxTable.id, old))
      .returning({ id: outboxTable.id });
    deleted += rows.length;
    if (rows.length < BATCH) return { deleted };
  }
}

export function pruneOutbox() {
  return withJobLease("outbox-prune", pruneDeadOutboxRows, () => ({
    deleted: 0,
  }));
}
