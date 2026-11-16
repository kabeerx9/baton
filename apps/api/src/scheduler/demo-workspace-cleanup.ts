import { and, asc, eq, lt } from "drizzle-orm";
import db from "../database";
import { workspaceTable } from "../database/schema";
import {
  afterDemoDeleted,
  deleteDemoWorkspace,
  lockDemoWorkspace,
} from "../tour/demo/delete-demo-workspace";
import { lockTourUser } from "../tour/lock-tour-user";
import { withJobLease } from "./leader-lock";

export const DEMO_WORKSPACE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const BATCH = 100;

/** Demo workspaces left behind by an abandoned tour, oldest first. */
async function listStaleDemos(cutoff: Date) {
  return db
    .select({ id: workspaceTable.id, ownerId: workspaceTable.demoOwnerUserId })
    .from(workspaceTable)
    .where(
      and(
        eq(workspaceTable.kind, "demo"),
        lt(workspaceTable.createdAt, cutoff),
      ),
    )
    .orderBy(asc(workspaceTable.createdAt), asc(workspaceTable.id))
    .limit(BATCH);
}

/**
 * Deletes demo workspaces older than 7 days. Each one is deleted in its own
 * transaction under the same locks as the tour routes (user, then
 * workspace), so a concurrent restart cannot interleave with it.
 */
export async function cleanupDemoWorkspaces(now = new Date()) {
  return withJobLease(
    "demo-workspace-cleanup",
    async () => {
      const cutoff = new Date(now.getTime() - DEMO_WORKSPACE_MAX_AGE_MS);
      let deletedCount = 0;
      let degraded = false;
      for (const stale of await listStaleDemos(cutoff)) {
        if (!stale.ownerId) continue;
        const ownerId = stale.ownerId;
        try {
          const deleted = await db.transaction(async (tx) => {
            await lockTourUser(tx, ownerId);
            const demo = await lockDemoWorkspace(tx, ownerId);
            // A restart may have replaced it since the list was read.
            if (demo?.id !== stale.id) return null;
            return deleteDemoWorkspace(tx, demo, ownerId);
          });
          await afterDemoDeleted(deleted);
          if (deleted) deletedCount += 1;
        } catch (error) {
          degraded = true;
          console.error("Demo workspace cleanup failed", {
            workspaceId: stale.id,
            error,
          });
        }
      }
      return { deleted: deletedCount, degraded };
    },
    () => ({ deleted: 0, degraded: false }),
  );
}
