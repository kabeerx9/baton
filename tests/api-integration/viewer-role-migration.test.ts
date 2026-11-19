// Migration 0006 rewrites every stored viewer role to the working viewer
// (task:update_assigned). Runs on a scratch database with its own pool.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { defaultRolePayloads } from "@baton/permissions";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";
import {
  migrationsFolder,
  migrationsThrough,
} from "./helpers/baseline-only-migrations";
import {
  createScratchDatabase,
  type ScratchDatabase,
} from "./helpers/scratch-database";

const VIEWER = "0006_viewer_works_on_assigned";
const before = migrationsThrough("0005_auth_boundary_drops");
let scratch: ScratchDatabase | undefined;
let pool: Pool | undefined;
let db: ReturnType<typeof drizzle>;

const MEMBER_PAYLOAD =
  '{"organization":[],"member":[],"invitation":[],"ac":["read"],"project":["create","read"],"task":["create","read","update"],"label":["create","read","update","delete"],"workspace":["read"]}';

async function roles() {
  const result = await db.execute<{
    id: string;
    role: string;
    permission: string;
  }>(sql`SELECT id, role, permission FROM workspace_role ORDER BY id`);
  return result.rows;
}

beforeAll(async () => {
  scratch = await createScratchDatabase("viewer_role_migration");
  pool = new Pool({ connectionString: scratch.url });
  db = drizzle(pool);
  await migrate(db, { migrationsFolder: before.folder });
  await db.execute(sql`
    INSERT INTO workspace (id, name, slug, created_at) VALUES
      ('w1', 'One', 'w1', now()), ('w2', 'Two', 'w2', now())`);
  await db.execute(sql`
    INSERT INTO workspace_role (id, workspace_id, role, permission) VALUES
      ('r1', 'w1', 'viewer',
       '{"organization":[],"member":[],"invitation":[],"team":[],"ac":["read"],"project":["read"],"task":["read"],"label":["read"],"workspace":["read"]}'),
      ('r2', 'w2', 'viewer', '{"task":["read"],"project":["read"]}'),
      ('r3', 'w1', 'member', ${MEMBER_PAYLOAD}),
      ('r4', 'w1', 'qa', '{"task":["read"]}')`);
  await migrate(db, { migrationsFolder });
});

afterAll(async () => {
  await pool?.end();
  before.remove();
  await scratch?.drop();
});

describe("migration 0006: the viewer works on assigned tasks", () => {
  it("writes the same payload the package seeds for new workspaces", () => {
    const text = readFileSync(join(migrationsFolder, `${VIEWER}.sql`), "utf8");
    expect(text).toContain(`'${JSON.stringify(defaultRolePayloads.viewer)}'`);
    expect(text).toContain(`WHERE "role" = 'viewer'`);
  });

  it("rewrites every stored viewer row, old shape or hand edited", async () => {
    const rows = await roles();
    for (const id of ["r1", "r2"]) {
      const row = rows.find((r) => r.id === id)!;
      expect(JSON.parse(row.permission), id).toEqual(
        defaultRolePayloads.viewer,
      );
    }
  });

  it("leaves other roles byte for byte", async () => {
    const rows = await roles();
    expect(rows.find((r) => r.id === "r3")?.permission).toBe(MEMBER_PAYLOAD);
    expect(rows.find((r) => r.id === "r4")?.permission).toBe(
      '{"task":["read"]}',
    );
  });
});
