import { and, asc, eq, getTableColumns, inArray, lte, sql } from "drizzle-orm";
import db from "../../database";
import { outboxTable } from "../../database/schema";

/** A claimed row may run until its lease ends; then another relay may take it. */
export const LEASE_MS = 60_000;

// Statement-stable, so the planner can bound the partial due index by it;
// clock_timestamp() is volatile and turns the bound into a row filter.
const dueCutoff = sql`(statement_timestamp() AT TIME ZONE 'utc')`;
const dbNow = sql`(clock_timestamp() AT TIME ZONE 'utc')`;

export type OutboxRow = typeof outboxTable.$inferSelect;

export type ClaimedRow = {
  row: OutboxRow;
  /** The row's age by the database clock when the claim committed. */
  ageMs: number;
  /** `performance.now()` when the claim returned. */
  claimedAt: number;
};

/**
 * Leases up to `limit` due rows for the given consumers in one short
 * statement. The claim spends one attempt (the fencing token) and pushes
 * `next_attempt_at` to the lease end. No lock is held after it returns.
 */
export async function claimOutboxRows(
  consumers: string[],
  limit: number,
): Promise<ClaimedRow[]> {
  if (!consumers.length) return [];
  const due = db
    .select({ id: outboxTable.id })
    .from(outboxTable)
    .where(
      and(
        eq(outboxTable.state, "pending"),
        lte(outboxTable.nextAttemptAt, dueCutoff),
        inArray(outboxTable.consumer, consumers),
      ),
    )
    .orderBy(asc(outboxTable.nextAttemptAt), asc(outboxTable.id))
    .limit(limit)
    .for("update", { skipLocked: true });
  const rows = await db
    .update(outboxTable)
    .set({
      attempts: sql`${outboxTable.attempts} + 1`,
      nextAttemptAt: sql`${dbNow} + ${LEASE_MS} * interval '1 millisecond'`,
    })
    .where(inArray(outboxTable.id, due))
    .returning({
      ...getTableColumns(outboxTable),
      ageMs: sql<number>`(EXTRACT(EPOCH FROM ${dbNow} - ${outboxTable.createdAt}) * 1000)::float8`,
    });
  const claimedAt = performance.now();
  return rows
    .map(({ ageMs, ...row }) => ({ row, ageMs: Number(ageMs), claimedAt }))
    .sort(
      (a, b) =>
        a.row.createdAt.getTime() - b.row.createdAt.getTime() ||
        a.row.id.localeCompare(b.row.id),
    );
}
