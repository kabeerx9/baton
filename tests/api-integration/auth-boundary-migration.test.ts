// auth-boundary P4 A8: the drops migration on a database that holds data,
// as on the hosted instance. It runs on a scratch database: the app's pool
// is created on first use, so `DATABASE_URL` is pointed there first.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";
import {
  migrationsFolder,
  migrationsThrough,
} from "./helpers/baseline-only-migrations";
import {
  pluginKeyFixture,
  pluginKeyNames,
  pluginKeyRow,
  replayPluginKeyRequests,
} from "./helpers/plugin-api-keys";
import {
  createScratchDatabase,
  type ScratchDatabase,
} from "./helpers/scratch-database";

const DROPS = "0005_auth_boundary_drops";
const suiteUrl = process.env.DATABASE_URL!;
let scratch: ScratchDatabase | undefined;

const beforeDrops = migrationsThrough("0004_user_time_zone");
type Database = typeof import("../../apps/api/src/database");
let database: Database;

const { owner, workspace, keys, behaviour } = pluginKeyFixture;
const SESSION_TOKEN = "auth-boundary-session-token";

async function rows(table: string) {
  const result = await database.default.execute<{ row: string }>(
    sql.raw(`SELECT row_to_json(t)::text AS row FROM "${table}" t ORDER BY id`),
  );
  return result.rows.map((entry) => entry.row);
}

async function seed() {
  const { default: db, schema } = database;
  await db.execute(sql`
    INSERT INTO "user" (id, name, email, email_verified, role) VALUES
      (${owner.id}, ${owner.name}, ${owner.email}, true, 'admin'),
      ('other-user', 'Other user', 'other-user@example.com', true, 'user')`);
  await db.execute(sql`
    INSERT INTO workspace (id, name, slug, created_at) VALUES
      (${workspace.id}, ${workspace.name}, ${workspace.id}, now()),
      ('second-workspace', 'Second', 'second-workspace', now())`);
  await db.execute(sql`
    INSERT INTO workspace_member (id, workspace_id, user_id, role, joined_at) VALUES
      ('member-1', ${workspace.id}, ${owner.id}, 'owner', now()),
      ('member-2', ${workspace.id}, 'other-user', 'member', now()),
      ('member-3', 'second-workspace', 'other-user', 'owner', now())`);
  // A custom role stored before `team` and `invitation` left the vocabulary.
  await db.execute(sql`
    INSERT INTO workspace_role (id, workspace_id, role, permission) VALUES
      ('role-qa', ${workspace.id}, 'qa',
       '{"task":["read"],"team":["create","update"],"invitation":["create"]}')`);
  await db.execute(sql`
    INSERT INTO invitation (id, workspace_id, email, role, status, expires_at, inviter_id) VALUES
      ('invitation-1', ${workspace.id}, 'invitee@example.com', 'member', 'canceled', now(), ${owner.id})`);
  await db.execute(sql`
    INSERT INTO team (id, name, workspace_id, created_at) VALUES
      ('team-1', ${workspace.name}, ${workspace.id}, now()),
      ('team-2', 'Second', 'second-workspace', now())`);
  await db.execute(sql`
    INSERT INTO team_member (id, team_id, user_id, created_at) VALUES
      ('team-member-1', 'team-1', ${owner.id}, now())`);
  await db.execute(sql`
    INSERT INTO session (id, expires_at, token, updated_at, user_id, active_organization_id, active_team_id) VALUES
      ('session-1', now() + interval '1 day', ${SESSION_TOKEN}, now(), 'other-user', ${workspace.id}, 'team-1')`);
  await db
    .insert(schema.apikeyTable)
    .values(pluginKeyNames.map((name) => pluginKeyRow(name, Date.now())));
}

const KEPT = ["workspace", "workspace_member", "workspace_role", "user"];
let before: Record<string, string[]>;

beforeAll(async () => {
  scratch = await createScratchDatabase("auth_boundary_migration", suiteUrl);
  process.env.DATABASE_URL = scratch.url;
  database = await import("../../apps/api/src/database");
  await migrate(database.default, { migrationsFolder: beforeDrops.folder });
  await seed();
  before = Object.fromEntries(
    await Promise.all(KEPT.map(async (table) => [table, await rows(table)])),
  );
  await migrate(database.default, { migrationsFolder });
});

afterAll(async () => {
  await database?.getDatabasePool().end();
  process.env.DATABASE_URL = suiteUrl;
  beforeDrops.remove();
  await scratch?.drop();
});

describe("the auth-boundary drops migration (A8)", () => {
  it("ships only the drops the record lists", () => {
    const text = readFileSync(join(migrationsFolder, `${DROPS}.sql`), "utf8");
    expect(
      text
        .split("--> statement-breakpoint")
        .map((statement) => statement.trim())
        .filter(Boolean),
    ).toEqual([
      'DROP TABLE "team_member", "team", "invitation";',
      'ALTER TABLE "session" DROP COLUMN "active_organization_id", DROP COLUMN "active_team_id", DROP COLUMN "impersonated_by";',
    ]);
    const journal = JSON.parse(
      readFileSync(join(migrationsFolder, "meta/_journal.json"), "utf8"),
    ) as { entries: { tag: string }[] };
    expect(journal.entries.map((entry) => entry.tag)).toContain(DROPS);
  });

  it("keeps workspace, member, role and user rows byte for byte", async () => {
    for (const table of KEPT) {
      expect(await rows(table), table).toEqual(before[table]);
    }
    const role = JSON.parse(before.workspace_role![0]!) as {
      permission: string;
    };
    expect(JSON.parse(role.permission)).toMatchObject({
      team: ["create", "update"],
      invitation: ["create"],
    });
  });

  it("removes the three tables and three session columns", async () => {
    const { default: db } = database;
    const tables = await db.execute<{ name: string | null }>(sql`
      SELECT to_regclass(name)::text AS name
      FROM unnest(ARRAY['team_member', 'team', 'invitation']) AS name`);
    expect(tables.rows).toEqual([
      { name: null },
      { name: null },
      { name: null },
    ]);
    const columns = await db.execute<{ column_name: string }>(sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'session'
        AND column_name IN ('active_organization_id', 'active_team_id', 'impersonated_by')`);
    expect(columns.rows).toEqual([]);
  });

  it("resolves the session that had an active organization", async () => {
    const { createApp } = await import("../../apps/api/src/index");
    const { app } = createApp();
    const response = await app.request("/api/user/me", {
      headers: { authorization: `Bearer ${SESSION_TOKEN}` },
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ id: "other-user" });
  });

  it("answers every plugin-made key as before", async () => {
    const { createApp } = await import("../../apps/api/src/index");
    const { app } = createApp();
    expect(keys.plain.row.referenceId).toBe(owner.id);
    expect(await replayPluginKeyRequests(app)).toEqual(behaviour);
  });
});
