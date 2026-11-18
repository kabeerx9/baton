import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { afterAll, beforeAll, expect, it } from "vite-plus/test";
import {
  baselineOnlyMigrations,
  migrationsThrough,
} from "./helpers/baseline-only-migrations";
import {
  createScratchDatabase,
  type ScratchDatabase,
} from "./helpers/scratch-database";

// The join-link migration on a database that already has invitations, as on
// the hosted instance. A scratch database keeps the suite's own untouched.
let pool: Pool;
let scratch: ScratchDatabase | undefined;
const baseline = baselineOnlyMigrations();
// Stop at the join-link migration: a later one drops `invitation`.
const joinLinks = migrationsThrough("0003_join_links");

beforeAll(async () => {
  scratch = await createScratchDatabase("join_link_migration");
  pool = new Pool({ connectionString: scratch.url });
});

afterAll(async () => {
  await pool?.end();
  baseline.remove();
  joinLinks.remove();
  await scratch?.drop();
});

it("cancels pending invitations, keeps the others, and adds both tables", async () => {
  const database = drizzle(pool);
  await migrate(database, { migrationsFolder: baseline.folder });
  await pool.query(
    `INSERT INTO "user" (id, name, email) VALUES ('owner', 'Owner', 'owner@example.com')`,
  );
  await pool.query(
    `INSERT INTO workspace (id, name, slug, created_at) VALUES ('ws-1', 'Team', 'team', now())`,
  );
  await pool.query(
    `INSERT INTO invitation (id, workspace_id, email, role, status, expires_at, inviter_id)
     VALUES
       ('pending-1', 'ws-1', 'a@example.com', 'member', 'pending', now() + interval '1 day', 'owner'),
       ('pending-2', 'ws-1', 'b@example.com', 'member', 'pending', now() - interval '1 day', 'owner'),
       ('accepted-1', 'ws-1', 'c@example.com', 'member', 'accepted', now(), 'owner'),
       ('rejected-1', 'ws-1', 'd@example.com', 'member', 'rejected', now(), 'owner')`,
  );

  await migrate(database, { migrationsFolder: joinLinks.folder });

  const statuses = await pool.query(
    `SELECT id, status FROM invitation ORDER BY id`,
  );
  expect(statuses.rows).toEqual([
    { id: "accepted-1", status: "accepted" },
    { id: "pending-1", status: "canceled" },
    { id: "pending-2", status: "canceled" },
    { id: "rejected-1", status: "rejected" },
  ]);

  const tables = await pool.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_name IN ('workspace_join_link', 'workspace_member_removal')
     ORDER BY table_name`,
  );
  expect(tables.rows.map((row) => row.table_name)).toEqual([
    "workspace_join_link",
    "workspace_member_removal",
  ]);

  // The CHECKs hold: only member links, no zero limits, no negative counts.
  const insert = (role: string, maxUses: number | null, useCount: number) =>
    pool.query(
      `INSERT INTO workspace_join_link (id, workspace_id, token_hash, role, max_uses, use_count, expires_at)
       VALUES ($1, 'ws-1', $1, $2, $3, $4, now() + interval '1 day')`,
      [`link-${role}-${maxUses}-${useCount}`, role, maxUses, useCount],
    );
  await expect(insert("owner", null, 0)).rejects.toThrow(/role_check/);
  await expect(insert("member", 0, 0)).rejects.toThrow(/max_uses_check/);
  await expect(insert("member", null, -1)).rejects.toThrow(/use_count_check/);
  await insert("member", 1, 0);
  // One link per workspace that is not revoked.
  await expect(insert("member", 2, 0)).rejects.toThrow(/one_open_uidx/);
});
