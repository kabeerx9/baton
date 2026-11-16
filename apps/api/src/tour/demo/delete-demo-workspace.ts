import { and, eq, inArray, or } from "drizzle-orm";
import {
  notificationTable,
  projectTable,
  sessionTable,
  taskTable,
  workspaceTable,
} from "../../database/schema";
import { publishEvent } from "../../events";
import type { OutboxTransaction } from "../../events/outbox/consumer";
import { queueStorageCleanup } from "../../storage/cleanup-queue";
import { listWorkspaceObjectKeys } from "../../workspace/lifecycle/list-workspace-object-keys";
import { revokeWorkspaceAudience } from "../../workspace/lifecycle/revoke-workspace-audience";

export type DeletedDemo = { workspaceId: string; ownerId: string };

/** The user's demo workspace, locked for a lifecycle change, or null. */
export async function lockDemoWorkspace(tx: OutboxTransaction, userId: string) {
  const [demo] = await tx
    .select({ id: workspaceTable.id, slug: workspaceTable.slug })
    .from(workspaceTable)
    .where(
      and(
        eq(workspaceTable.kind, "demo"),
        eq(workspaceTable.demoOwnerUserId, userId),
      ),
    )
    .for("update");
  return demo ?? null;
}

/**
 * Deletes a demo workspace in the caller's transaction. The foreign keys
 * cascade to members, roles, projects, columns, tasks, relations, comments,
 * activity, change requests and outbox rows. Notifications have no foreign
 * key to their resource, so they are deleted here first. Call
 * `afterDemoDeleted` once the transaction commits.
 */
export async function deleteDemoWorkspace(
  tx: OutboxTransaction,
  demo: { id: string },
  ownerId: string,
): Promise<DeletedDemo> {
  const taskIds = tx
    .select({ id: taskTable.id })
    .from(taskTable)
    .innerJoin(projectTable, eq(projectTable.id, taskTable.projectId))
    .where(eq(projectTable.workspaceId, demo.id));
  await tx
    .delete(notificationTable)
    .where(
      or(
        and(
          eq(notificationTable.resourceType, "task"),
          inArray(notificationTable.resourceId, taskIds),
        ),
        and(
          eq(notificationTable.resourceType, "workspace"),
          eq(notificationTable.resourceId, demo.id),
        ),
      ),
    );
  // Uploads made during the tour are removed only if the rows go too.
  await queueStorageCleanup(tx, await listWorkspaceObjectKeys(demo.id, tx));
  await tx
    .update(sessionTable)
    .set({ activeOrganizationId: null, activeTeamId: null })
    .where(eq(sessionTable.activeOrganizationId, demo.id));
  await tx.delete(workspaceTable).where(eq(workspaceTable.id, demo.id));
  return { workspaceId: demo.id, ownerId };
}

/**
 * After commit: close the owner's realtime access to the deleted workspace
 * and tell their open clients. The owner is the only member, and instance
 * administrators cannot reach a demo workspace.
 */
export async function afterDemoDeleted(deleted: DeletedDemo | null) {
  if (!deleted) return;
  await revokeWorkspaceAudience([deleted.ownerId], deleted.workspaceId);
  await publishEvent("workspace.deleted", {
    workspaceId: deleted.workspaceId,
  }).catch((error) => {
    console.error("Failed to publish workspace deleted event:", error);
  });
}
