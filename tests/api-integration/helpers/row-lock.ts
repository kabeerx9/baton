import { sql } from "drizzle-orm";
import { Client } from "pg";
import db from "../../../apps/api/src/database";

/**
 * Holds `SELECT ... FOR UPDATE` on one row from a separate connection, so a
 * test can line requests up behind it and then release them together.
 */
export async function holdRowLock(table: string, id: string) {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  await client.query("BEGIN");
  await client.query(
    `SELECT 1 FROM "${table.replaceAll('"', '""')}" WHERE id = $1 FOR UPDATE`,
    [id],
  );
  return {
    async release() {
      try {
        await client.query("COMMIT");
      } finally {
        await client.end();
      }
    },
  };
}

/** Waits until at least `count` backends wait on a row or tuple lock. */
export async function waitForLockWaiters(count: number, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const result = await db.execute<{ waiting: number }>(sql`
      SELECT count(*)::int AS waiting FROM pg_stat_activity
      WHERE datname = current_database() AND wait_event_type = 'Lock'
    `);
    if ((result.rows[0]?.waiting ?? 0) >= count) return;
    if (Date.now() > deadline)
      throw new Error(`Timed out waiting for ${count} lock waiters`);
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}
