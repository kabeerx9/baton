// auth-boundary P4 A9: a failed drops migration changes nothing. The
// migrator runs every pending migration in one transaction, so when the
// second drop fails the first is rolled back, the journal keeps its rows,
// and the API process exits non-zero instead of serving.
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { afterAll, beforeAll, expect, it } from "vite-plus/test";
import { migrationsThrough } from "./helpers/baseline-only-migrations";
import {
  createScratchDatabase,
  type ScratchDatabase,
} from "./helpers/scratch-database";

const repoRoot = resolve(import.meta.dirname, "../..");

const beforeDrops = migrationsThrough("0004_user_time_zone");
// The child runs outside the repo so it cannot load the root `.env`.
const childCwd = mkdtempSync(join(tmpdir(), "baton-startup-"));
let pool: Pool;
let scratch: ScratchDatabase | undefined;

beforeAll(async () => {
  scratch = await createScratchDatabase("auth_boundary_failure");
  pool = new Pool({ connectionString: scratch.url });
  await migrate(drizzle(pool), { migrationsFolder: beforeDrops.folder });
});

afterAll(async () => {
  await pool?.end();
  beforeDrops.remove();
  rmSync(childCwd, { recursive: true, force: true });
  await scratch?.drop();
});

function startApi() {
  const child = spawn(
    join(repoRoot, "apps/api/node_modules/.bin/tsx"),
    [join(repoRoot, "tests/api-integration/helpers/start-api-server.ts")],
    {
      cwd: childCwd,
      env: {
        PATH: process.env.PATH,
        HOME: process.env.HOME,
        NODE_ENV: "test",
        DATABASE_URL: scratch!.url,
        AUTH_SECRET: "test-secret-with-at-least-32-chars",
        BATON_API_URL: "http://localhost:1337",
        BATON_CLIENT_URL: "http://localhost:5173",
        PORT: "0",
      },
    },
  );
  let output = "";
  child.stdout.on("data", (chunk) => (output += chunk));
  child.stderr.on("data", (chunk) => (output += chunk));
  return new Promise<{ code: number | null; output: string }>((done, fail) => {
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      fail(new Error(`The API did not exit:\n${output}`));
    }, 45_000);
    child.on("exit", (code) => {
      clearTimeout(timer);
      done({ code, output });
    });
  });
}

async function state() {
  const tables = await pool.query(
    `SELECT to_regclass(name)::text AS name
     FROM unnest(ARRAY['team_member', 'team', 'invitation']) AS name`,
  );
  const columns = await pool.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'session'
       AND column_name IN ('active_organization_id', 'active_team_id', 'impersonated_by')
     ORDER BY column_name`,
  );
  const journal = await pool.query(
    `SELECT id, hash, created_at FROM drizzle.__drizzle_migrations ORDER BY id`,
  );
  const teams = await pool.query(`SELECT id FROM team ORDER BY id`);
  return {
    tables: tables.rows,
    columns: columns.rows,
    journal: journal.rows,
    teams: teams.rows,
  };
}

it("rolls back every drop and exits non-zero when one drop fails", async () => {
  await pool.query(
    `INSERT INTO workspace (id, name, slug, created_at) VALUES ('ws-1', 'One', 'one', now())`,
  );
  await pool.query(
    `INSERT INTO team (id, name, workspace_id, created_at) VALUES ('team-1', 'One', 'ws-1', now())`,
  );
  // The injected error: a view on a dropped column makes the second
  // statement fail after the first has dropped the tables.
  await pool.query(
    `CREATE VIEW blocks_drop AS SELECT active_team_id FROM session`,
  );
  const before = await state();
  expect(before.tables).toEqual([
    { name: "team_member" },
    { name: "team" },
    { name: "invitation" },
  ]);
  expect(before.columns).toHaveLength(3);

  const result = await startApi();

  expect(result.code, result.output).not.toBe(0);
  expect(result.output).toContain("Database migrations failed");
  expect(result.output).toContain("depend");
  expect(await state()).toEqual(before);
});
