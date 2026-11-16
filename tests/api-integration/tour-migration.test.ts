import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Client, Pool } from "pg";
import { afterAll, beforeAll, expect, it } from "vite-plus/test";
import {
  baselineOnlyMigrations,
  migrationsFolder,
} from "./helpers/baseline-only-migrations";

// A4: the tour migration on a database that already has users, as on the
// hosted instance and existing dev databases. A scratch database keeps the
// suite's own database untouched.
const scratchName = `${new URL(process.env.DATABASE_URL!).pathname.slice(1)}_tour_migration`;

function urlFor(database: string) {
  const url = new URL(process.env.DATABASE_URL!);
  url.pathname = `/${database}`;
  return url.toString();
}

async function admin(statement: string) {
  const client = new Client({ connectionString: urlFor("postgres") });
  await client.connect();
  try {
    await client.query(statement);
  } finally {
    await client.end();
  }
}

let pool: Pool;
const baseline = baselineOnlyMigrations();

beforeAll(async () => {
  await admin(`DROP DATABASE IF EXISTS "${scratchName}"`);
  await admin(`CREATE DATABASE "${scratchName}"`);
  pool = new Pool({ connectionString: urlFor(scratchName) });
});

afterAll(async () => {
  await pool?.end();
  baseline.remove();
  await admin(`DROP DATABASE IF EXISTS "${scratchName}"`);
});

it("backfills existing users as done, leaves new users pending, and marks old workspaces as team", async () => {
  const database = drizzle(pool);
  await migrate(database, { migrationsFolder: baseline.folder });
  await pool.query(
    `INSERT INTO "user" (id, name, email) VALUES ('old-1', 'Old', 'old-1@example.com'), ('old-2', 'Old', 'old-2@example.com')`,
  );
  await pool.query(
    `INSERT INTO workspace (id, name, slug, created_at) VALUES ('ws-1', 'Team', 'team', now())`,
  );

  await migrate(database, { migrationsFolder });

  const old = await pool.query(
    `SELECT id, tour_completed_at FROM "user" ORDER BY id`,
  );
  expect(old.rows).toHaveLength(2);
  for (const row of old.rows)
    expect(row.tour_completed_at).toBeInstanceOf(Date);

  await pool.query(
    `INSERT INTO "user" (id, name, email) VALUES ('new-1', 'New', 'new-1@example.com')`,
  );
  const fresh = await pool.query(
    `SELECT tour_completed_at FROM "user" WHERE id = 'new-1'`,
  );
  expect(fresh.rows[0].tour_completed_at).toBeNull();

  const workspace = await pool.query(
    `SELECT kind, demo_owner_user_id FROM workspace WHERE id = 'ws-1'`,
  );
  expect(workspace.rows[0]).toEqual({ kind: "team", demo_owner_user_id: null });
});
