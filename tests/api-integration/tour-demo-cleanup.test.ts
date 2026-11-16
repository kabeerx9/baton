import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { cleanupDemoWorkspaces } from "../../apps/api/src/scheduler/demo-workspace-cleanup";
import { seedDemoWorkspace } from "../../apps/api/src/tour/demo/seed-demo-workspace";
import { resetTestDatabase } from "./helpers/database";
import { createWorkspaceMember } from "./helpers/fixtures";

beforeEach(resetTestDatabase);

const DAY = 24 * 60 * 60 * 1000;

async function demoAged(days: number) {
  const { user } = await createWorkspaceMember();
  const seeded = await db.transaction((tx) => seedDemoWorkspace(tx, user.id));
  await db
    .update(schema.workspaceTable)
    .set({ createdAt: new Date(Date.now() - days * DAY) })
    .where(eq(schema.workspaceTable.id, seeded.demoWorkspace.id));
  return seeded.demoWorkspace.id;
}

async function exists(workspaceId: string) {
  const rows = await db
    .select({ id: schema.workspaceTable.id })
    .from(schema.workspaceTable)
    .where(eq(schema.workspaceTable.id, workspaceId));
  return rows.length === 1;
}

describe("demo workspace cleanup job", () => {
  it("deletes demos older than 7 days and keeps younger demos and team workspaces", async () => {
    const stale = await demoAged(8);
    const fresh = await demoAged(6);
    const { workspace: oldTeam } = await createWorkspaceMember();
    await db
      .update(schema.workspaceTable)
      .set({ createdAt: new Date(Date.now() - 30 * DAY) })
      .where(eq(schema.workspaceTable.id, oldTeam.id));

    expect(await cleanupDemoWorkspaces()).toEqual({
      deleted: 1,
      degraded: false,
    });
    expect(await exists(stale)).toBe(false);
    expect(await exists(fresh)).toBe(true);
    expect(await exists(oldTeam.id)).toBe(true);
  });

  it("does nothing while another instance holds the lease", async () => {
    const stale = await demoAged(8);
    await db.insert(schema.jobLeaseTable).values({
      name: "demo-workspace-cleanup",
      owner: `other-${randomUUID()}`,
      expiresAt: new Date(Date.now() + DAY),
    });
    expect(await cleanupDemoWorkspaces()).toEqual({
      deleted: 0,
      degraded: false,
    });
    expect(await exists(stale)).toBe(true);
  });
});
