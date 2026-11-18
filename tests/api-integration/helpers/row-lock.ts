import { sql } from "drizzle-orm";
import { Client } from "pg";
import db from "../../../apps/api/src/database";

const quote = (name: string) => `"${name.replaceAll('"', '""')}"`;

/**
 * Holds `SELECT ... FOR UPDATE` on the rows matching `key` from a separate
 * connection, so a test can line requests up behind it and then release
 * them together. Release is idempotent; always call it in a `finally`.
 */
export async function holdRowLock(
  table: string,
  key: Record<string, string> | string,
) {
  const columns = typeof key === "string" ? { id: key } : key;
  const names = Object.keys(columns);
  const where = names
    .map((name, index) => `${quote(name)} = $${index + 1}`)
    .join(" AND ");
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query("BEGIN");
    const locked = await client.query(
      `SELECT 1 FROM ${quote(table)} WHERE ${where} FOR UPDATE`,
      Object.values(columns),
    );
    if (locked.rowCount === 0) throw new Error(`No ${table} row to lock`);
  } catch (error) {
    // Never leave an idle-in-transaction connection behind.
    await client.end().catch(() => {});
    throw error;
  }
  let released = false;
  return {
    async release() {
      if (released) return;
      released = true;
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

type Lock = Awaited<ReturnType<typeof holdRowLock>>;

/**
 * Starts each stage's requests while `lock` is held, waits until `waiters`
 * backends queue on locks after that stage, then releases the lock before
 * awaiting the requests. When a wait fails, it releases the lock, lets every
 * started request settle, then rethrows the wait's error.
 */
export async function releaseWhenQueued<T>(
  lock: Lock,
  stages: Array<{ start: () => Promise<T>[]; waiters: number }>,
): Promise<T[]> {
  const started: Promise<T>[] = [];
  try {
    for (const stage of stages) {
      started.push(...stage.start());
      await waitForLockWaiters(stage.waiters);
    }
  } catch (error) {
    // Let every started request finish before the test fails, so none is
    // still running when the next test resets the database.
    await lock.release();
    await Promise.allSettled(started);
    throw error;
  }
  await lock.release();
  return Promise.all(started);
}
