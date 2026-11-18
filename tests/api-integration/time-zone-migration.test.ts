import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Client, Pool } from "pg";
import { afterAll, beforeAll, expect, it } from "vite-plus/test";
import {
  baselineOnlyMigrations,
  migrationsFolder,
} from "./helpers/baseline-only-migrations";

// The time zone migration on a database that already has users, as on the
// hosted instance. A scratch database keeps the suite's own database untouched.
const scratchName = `${new URL(process.env.DATABASE_URL!).pathname.slice(1)}_time_zone_migration`;

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

it("leaves every existing user without a zone", async () => {
  const database = drizzle(pool);
  await migrate(database, { migrationsFolder: baseline.folder });
  await pool.query(
    `INSERT INTO "user" (id, name, email) VALUES ('old-1', 'Old', 'old-1@example.com'), ('old-2', 'Old', 'old-2@example.com')`,
  );

  await migrate(database, { migrationsFolder });

  const rows = await pool.query(`SELECT id, time_zone FROM "user" ORDER BY id`);
  expect(rows.rows).toEqual([
    { id: "old-1", time_zone: null },
    { id: "old-2", time_zone: null },
  ]);
});
