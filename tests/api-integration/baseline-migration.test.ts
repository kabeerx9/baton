import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { is, sql } from "drizzle-orm";
import { getTableConfig, PgTable } from "drizzle-orm/pg-core";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { beforeEach, expect, it } from "vite-plus/test";
import db from "../../apps/api/src/database";
import * as tables from "../../apps/api/src/database/schema";
import { resetTestDatabase } from "./helpers/database";
import { createWorkspaceMember } from "./helpers/fixtures";
import { outboxTaskFixture } from "./helpers/outbox";

const migrationsFolder = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../apps/api/drizzle",
);

beforeEach(resetTestDatabase);

async function rows<T>(query: ReturnType<typeof sql>) {
  return (await db.execute(query)).rows as T[];
}

it("ships the baseline first, then later migrations", () => {
  const journal = JSON.parse(
    readFileSync(resolve(migrationsFolder, "meta/_journal.json"), "utf8"),
  ) as { entries: Array<{ tag: string }> };
  expect(journal.entries.map((entry) => entry.tag)).toEqual([
    "0000_baseline",
    "0001_demo_workspace_and_tour",
  ]);
});

it("records every migration in a freshly migrated database", async () => {
  const migrations = readMigrationFiles({ migrationsFolder });
  expect(
    await rows(
      sql`SELECT hash, created_at::bigint AS created_at FROM drizzle.__drizzle_migrations ORDER BY id`,
    ),
  ).toEqual(
    migrations.map((migration) => ({
      hash: migration.hash,
      created_at: String(migration.folderMillis),
    })),
  );
});

it("creates every table that schema.ts declares, and no others", async () => {
  const declared = [
    ...new Set(
      Object.values(tables)
        .filter((value) => is(value, PgTable))
        .map((table) => getTableConfig(table).name),
    ),
  ].sort();
  const created = await rows<{ table_name: string }>(
    sql`SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        ORDER BY table_name`,
  );
  expect(created.map((row) => row.table_name).sort()).toEqual(declared);
  expect(declared).toContain("outbox");
  expect(declared).toContain("task_change_request");
});

it("creates the outbox with its claim budget and due index", async () => {
  expect(
    await rows(
      sql`SELECT data_type, column_default, is_nullable
          FROM information_schema.columns
          WHERE table_name = 'outbox' AND column_name = 'exempt_claims'`,
    ),
  ).toEqual([{ data_type: "integer", column_default: "0", is_nullable: "NO" }]);
  const [due] = await rows<{ indexdef: string }>(
    sql`SELECT indexdef FROM pg_indexes WHERE indexname = 'outbox_due_idx'`,
  );
  expect(due?.indexdef).toContain("WHERE (state = 'pending'::text)");

  const { workspace } = await outboxTaskFixture();
  await db.execute(
    sql`INSERT INTO outbox (id, workspace_id, type, consumer, payload)
        VALUES ('o1', ${workspace.id}, 'task.status_changed', 'activity', '{"v":1}')`,
  );
  await db.execute(sql`DELETE FROM workspace WHERE id = ${workspace.id}`);
  expect(await rows(sql`SELECT id FROM outbox`)).toEqual([]);
});

it("carries the hand-written triggers and stricter columns of the old chain", async () => {
  expect(
    await rows(
      sql`SELECT tgname FROM pg_trigger WHERE NOT tgisinternal ORDER BY tgname`,
    ),
  ).toEqual([
    { tgname: "account_credential_generation" },
    { tgname: "asset_storage_cleanup" },
    { tgname: "project_storage_cleanup" },
  ]);
  expect(
    await rows(
      sql`SELECT table_name, column_name, column_default, is_nullable
          FROM information_schema.columns
          WHERE (table_name, column_name) IN (('user', 'email_verified'), ('label', 'workspace_id'))
          ORDER BY table_name`,
    ),
  ).toEqual([
    {
      table_name: "label",
      column_name: "workspace_id",
      column_default: null,
      is_nullable: "NO",
    },
    {
      table_name: "user",
      column_name: "email_verified",
      column_default: "false",
      is_nullable: "NO",
    },
  ]);
});

it.each([null, "nonexistent-user"])(
  "rejects an API key without a real owner: %s",
  async (owner) => {
    await expect(
      db.execute(
        sql`INSERT INTO apikey (id, key, reference_id, created_at, updated_at)
            VALUES ('bad', 'bad-hash', ${owner}, now(), now())`,
      ),
    ).rejects.toThrow();
  },
);

it("deletes a user's API keys with the user", async () => {
  const { user } = await createWorkspaceMember();
  await db.execute(
    sql`INSERT INTO apikey (id, key, reference_id, created_at, updated_at)
        VALUES ('owned', 'owned-hash', ${user.id}, now(), now())`,
  );
  expect(await rows(sql`SELECT id FROM apikey`)).toEqual([{ id: "owned" }]);

  await db.execute(sql`DELETE FROM "user" WHERE id = ${user.id}`);
  expect(await rows(sql`SELECT id FROM apikey`)).toEqual([]);
});
