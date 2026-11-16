import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { PoolClient } from "pg";
import { afterEach, beforeEach, expect, it } from "vite-plus/test";
import { getDatabasePool } from "../../apps/api/src/database";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";
import { addWorkspaceMember } from "./helpers/project-access/add-workspace-member";

// Upgrade test for 0077 on a populated database. 0077 only adds objects, so
// the schema before it is today's schema without them. One transaction drops
// them, seeds rows in the old shape, runs the real migration file, checks the
// result, and rolls everything back.

const drizzleFolder = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../apps/api/drizzle",
);
const migrationTag = "0077_task_change_requests";

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

// Later migrations that only add new, unrelated tables leave the premise
// intact. Add one here only after checking it touches none of 0077's objects.
const independentLaterMigrations = [
  "0078_mcp_grants",
  "0079_mcp_token_expiry_index",
  "0080_mcp_credential_generation",
  "0081_outbox",
];

it("is the latest migration that changes these tables, so the old schema is today's without it", () => {
  const journal = JSON.parse(
    readFileSync(resolve(drizzleFolder, "meta/_journal.json"), "utf8"),
  ) as { entries: Array<{ tag: string }> };
  const tags = journal.entries.map((entry) => entry.tag);
  expect(tags.slice(tags.indexOf(migrationTag) + 1)).toEqual(
    independentLaterMigrations,
  );
});

it("upgrades a populated database and backfills creators from history", async () => {
  const { user: alice, workspace } = await createWorkspaceMember();
  const bob = await addWorkspaceMember(workspace.id);
  const { project } = await createProjectFixture({ workspaceId: workspace.id });

  client = await getDatabasePool().connect();
  const q = (text: string, values: unknown[] = []) =>
    client!.query(text, values);
  await q("BEGIN");
  await q("DROP TABLE task_change_request");
  await q("ALTER TABLE activity DROP COLUMN channel");
  await q("ALTER TABLE task DROP COLUMN created_by");
  await q("ALTER TABLE task DROP COLUMN status_generation");

  const created = "2026-10-01 12:00:00";
  const tasks = {
    byAlice: "mig-task-alice",
    earliestWins: "mig-task-earliest",
    nullUser: "mig-task-null-user",
    tooLate: "mig-task-too-late",
    importOnly: "mig-task-import",
    noHistory: "mig-task-none",
  };
  for (const [index, id] of Object.values(tasks).entries())
    await q(
      `INSERT INTO task (id, project_id, title, status, number, created_at)
       VALUES ($1, $2, $3, 'to-do', $4, $5)`,
      [id, project.id, id, index + 1, created],
    );
  const activity = (
    id: string,
    taskId: string,
    type: string,
    userId: string | null,
    at: string,
  ) =>
    q(
      `INSERT INTO activity (id, task_id, type, user_id, created_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, taskId, type, userId, at],
    );
  await activity(
    "a1",
    tasks.byAlice,
    "created",
    alice.id,
    "2026-10-01 12:00:01",
  );
  await activity(
    "a2",
    tasks.earliestWins,
    "created",
    bob.id,
    "2026-10-01 12:00:02",
  );
  await activity(
    "a3",
    tasks.earliestWins,
    "created",
    alice.id,
    "2026-10-01 12:00:03",
  );
  await activity("a4", tasks.nullUser, "created", null, "2026-10-01 12:00:01");
  await activity(
    "a5",
    tasks.tooLate,
    "created",
    alice.id,
    "2026-10-01 13:00:00",
  );
  await activity(
    "a6",
    tasks.importOnly,
    "create",
    alice.id,
    "2026-10-01 12:00:01",
  );

  for (const statement of migrationStatements()) await q(statement);

  const { rows } = await q(
    "SELECT id, created_by, status_generation FROM task ORDER BY id",
  );
  const creators = Object.fromEntries(
    rows.map((row) => [row.id, row.created_by]),
  );
  expect(creators).toEqual({
    [tasks.byAlice]: alice.id,
    [tasks.earliestWins]: bob.id,
    [tasks.nullUser]: null,
    [tasks.tooLate]: null,
    [tasks.importOnly]: null,
    [tasks.noHistory]: null,
  });
  const backfilled = rows.filter((row) => row.created_by !== null).length;
  expect({ total: rows.length, backfilled }).toEqual({
    total: 6,
    backfilled: 2,
  });
  expect(rows.every((row) => row.status_generation === 0)).toBe(true);

  const channels = await q("SELECT DISTINCT channel FROM activity");
  expect(channels.rows).toEqual([{ channel: null }]);

  // The partial unique index allows one pending request per task.
  const request = (id: string, state: string) =>
    q(
      `INSERT INTO task_change_request
         (id, task_id, workspace_id, project_id, task_key, task_title,
          requested_by, kind, target_status, base_status, base_generation,
          state, expires_at)
       VALUES ($1, $2, $3, $4, 'K-1', 't', $5, 'status', 'done', 'to-do', 0,
               $6, now() + interval '1 day')`,
      [id, tasks.byAlice, workspace.id, project.id, alice.id, state],
    );
  await request("r1", "pending");
  await request("r2", "rejected");
  await q("SAVEPOINT duplicate");
  await expect(request("r3", "pending")).rejects.toMatchObject({
    code: "23505",
  });
  await q("ROLLBACK TO SAVEPOINT duplicate");

  // Deleting the task keeps the row, its snapshot and a null reference.
  await q("DELETE FROM task WHERE id = $1", [tasks.byAlice]);
  const kept = await q(
    "SELECT task_id, task_key FROM task_change_request WHERE id = 'r1'",
  );
  expect(kept.rows).toEqual([{ task_id: null, task_key: "K-1" }]);
});
