import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { PoolClient } from "pg";
import { afterEach, beforeEach, expect, it } from "vite-plus/test";
import { getDatabasePool } from "../../apps/api/src/database";
import { resetTestDatabase } from "./helpers/database";
import { outboxTaskFixture } from "./helpers/outbox";

// Upgrade test for 0081 on a populated database. 0081 only adds the outbox
// table, so the schema before it is today's schema without that table. One
// transaction drops it, runs the real migration file, checks the result and
// rolls everything back.

const drizzleFolder = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../apps/api/drizzle",
);
const migrationTag = "0081_outbox";

let client: PoolClient | undefined;
beforeEach(resetTestDatabase);
afterEach(async () => {
  await client?.query("ROLLBACK").catch(() => undefined);
  client?.release();
  client = undefined;
});

function migrationStatements() {
  return readFileSync(resolve(drizzleFolder, `${migrationTag}.sql`), "utf8")
    .split("--> statement-breakpoint")
    .map((statement) => statement.trim())
    .filter(Boolean);
}

it("is the latest migration", () => {
  const journal = JSON.parse(
    readFileSync(resolve(drizzleFolder, "meta/_journal.json"), "utf8"),
  ) as { entries: Array<{ tag: string }> };
  expect(journal.entries.at(-1)?.tag).toBe(migrationTag);
});

it("only creates objects: no drop, alter or data change", () => {
  for (const statement of migrationStatements())
    expect(statement).toMatch(
      /^CREATE (TABLE|INDEX)|^ALTER TABLE "outbox" ADD CONSTRAINT/,
    );
});

it("applies on a populated database and keeps existing rows", async () => {
  const { task, workspace } = await outboxTaskFixture();
  client = await getDatabasePool().connect();
  const q = (text: string, values: unknown[] = []) =>
    client!.query(text, values);
  await q("BEGIN");
  await q("DROP TABLE outbox");

  for (const statement of migrationStatements()) await q(statement);

  expect((await q("SELECT id FROM task")).rows).toEqual([{ id: task.id }]);
  const inserted = await q(
    `INSERT INTO outbox (id, workspace_id, type, consumer, payload)
     VALUES ('o1', $1, 'task.status_changed', 'activity', '{"v":1}')
     RETURNING state, attempts, next_attempt_at IS NOT NULL AS due, created_at IS NOT NULL AS stamped`,
    [workspace.id],
  );
  expect(inserted.rows).toEqual([
    { state: "pending", attempts: 0, due: true, stamped: true },
  ]);
  const indexes = await q(
    "SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'outbox' ORDER BY indexname",
  );
  expect(indexes.rows.map((row) => row.indexname)).toEqual([
    "outbox_due_idx",
    "outbox_pkey",
    "outbox_workspace_idx",
  ]);
  expect(
    indexes.rows.find((row) => row.indexname === "outbox_due_idx")?.indexdef,
  ).toContain("WHERE (state = 'pending'::text)");

  await q("DELETE FROM workspace WHERE id = $1", [workspace.id]);
  expect((await q("SELECT count(*)::int AS n FROM outbox")).rows).toEqual([
    { n: 0 },
  ]);
});
