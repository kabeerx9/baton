import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { afterAll, beforeAll, expect, it } from "vite-plus/test";
import {
  baselineOnlyMigrations,
  migrationsFolder,
} from "./helpers/baseline-only-migrations";
import {
  createScratchDatabase,
  type ScratchDatabase,
} from "./helpers/scratch-database";

// The time zone migration on a database that already has users, as on the
// hosted instance. A scratch database keeps the suite's own database untouched.
let pool: Pool;
let scratch: ScratchDatabase | undefined;
const baseline = baselineOnlyMigrations();

beforeAll(async () => {
  scratch = await createScratchDatabase("time_zone_migration");
  pool = new Pool({ connectionString: scratch.url });
});

afterAll(async () => {
  await pool?.end();
  baseline.remove();
  await scratch?.drop();
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
