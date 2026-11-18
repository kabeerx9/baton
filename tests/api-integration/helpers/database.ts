import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Client } from "pg";
import db from "../../../apps/api/src/database";

const currentDir = dirname(fileURLToPath(import.meta.url));
const migrationsFolder = resolve(currentDir, "../../../apps/api/drizzle");

let migrationPromise: Promise<void> | null = null;

function getDatabaseName(connectionString: string) {
  return new URL(connectionString).pathname.replace(/^\//, "");
}

function getAdminDatabaseUrl(connectionString: string) {
  const url = new URL(connectionString);
  url.pathname = "/postgres";
  return url.toString();
}

function quoteIdentifier(identifier: string) {
  return `"${identifier.replaceAll('"', '""')}"`;
}

async function ensureTestDatabaseExists() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL must be defined for integration tests");
  }

  const databaseName = getDatabaseName(connectionString);

  if (!databaseName.endsWith("_test")) {
    throw new Error(
      `Refusing to manage non-test database "${databaseName}". DATABASE_URL must point to a test database.`,
    );
  }

  const adminClient = new Client({
    connectionString: getAdminDatabaseUrl(connectionString),
  });

  await adminClient.connect();

  try {
    const result = await adminClient.query(
      "SELECT 1 FROM pg_database WHERE datname = $1",
      [databaseName],
    );

    if (result.rowCount === 0) {
      await adminClient.query(
        `CREATE DATABASE ${quoteIdentifier(databaseName)}`,
      );
    }
  } finally {
    await adminClient.end();
  }
}

export async function ensureTestDatabaseMigrated() {
  if (!migrationPromise) {
    migrationPromise = (async () => {
      await ensureTestDatabaseExists();
      await migrate(db, {
        migrationsFolder,
      });
    })();
  }

  try {
    await migrationPromise;
  } catch (error) {
    migrationPromise = null;
    throw error;
  }
}

// Ponytail: query Postgres directly. The catalog is the canonical source of
// what tables actually exist after migrations run. Reflecting on the schema
// object in apps/api/src/database misses any table that is not exported from
// the index.ts registry (for example mcp_oauth_state and task_reminder_sent).
async function listPublicTableNames(): Promise<string[]> {
  const result = await db.execute<{ table_name: string }>(sql`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);

  return result.rows.map((row) => row.table_name);
}

export async function resetTestDatabase() {
  await ensureTestDatabaseMigrated();

  const tableNames = await listPublicTableNames();

  if (tableNames.length === 0) {
    throw new Error(
      "resetTestDatabase found no tables to truncate. Did migrations run?",
    );
  }

  const formattedTableNames = tableNames.map(quoteIdentifier).join(", ");
  const truncate = sql.raw(
    `TRUNCATE TABLE ${formattedTableNames} RESTART IDENTITY CASCADE`,
  );

  // Event handlers run after the response (EventEmitter drops their
  // promises), so the previous test's notification or permission queries can
  // still hold table locks. TRUNCATE locks tables one by one, so it can
  // deadlock with them. Wait for them to finish, and retry if one starts
  // between the wait and the TRUNCATE.
  for (let attempt = 1; ; attempt++) {
    await waitForOtherBackendsIdle();
    try {
      await db.transaction(async (tx) => {
        await tx.execute(sql`SET LOCAL lock_timeout = '2s'`);
        await tx.execute(truncate);
      });
      return;
    } catch (error) {
      if (attempt >= TRUNCATE_ATTEMPTS || !isLockConflict(error)) throw error;
      await new Promise((done) => setTimeout(done, 50 * attempt));
    }
  }
}

const TRUNCATE_ATTEMPTS = 5;

/** 40P01 deadlock_detected, 55P03 lock_not_available (lock_timeout). */
function isLockConflict(error: unknown): boolean {
  for (let e = error; e; e = (e as { cause?: unknown }).cause) {
    const code = (e as { code?: unknown }).code;
    if (code === "40P01" || code === "55P03") return true;
  }
  return false;
}

/**
 * Polls until no other session on this database runs a query or holds an
 * open transaction, for at most `timeoutMs`. Gives up quietly: the TRUNCATE
 * retry still covers a backend that stays busy.
 */
async function waitForOtherBackendsIdle(timeoutMs = 2000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const result = await db.execute<{ busy: number }>(sql`
      SELECT count(*)::int AS busy
      FROM pg_stat_activity
      WHERE datname = current_database()
        AND pid <> pg_backend_pid()
        AND backend_type = 'client backend'
        AND state IN ('active', 'idle in transaction')
    `);
    if ((result.rows[0]?.busy ?? 0) === 0) return;
    await new Promise((done) => setTimeout(done, 20));
  }
}
