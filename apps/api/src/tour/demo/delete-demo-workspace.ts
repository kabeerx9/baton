import { and, eq } from "drizzle-orm";
import { workspaceTable } from "../../database/schema";
import { publishEvent } from "../../events";
import { deleteResourceNotifications } from "../../notification/delete-resource-notifications";
import type { OutboxTransaction } from "../../events/outbox/consumer";
import { queueStorageCleanup } from "../../storage/cleanup-queue";
import { listWorkspaceObjectKeys } from "../../workspace/lifecycle/list-workspace-object-keys";
import { revokeWorkspaceAudience } from "../../workspace/lifecycle/revoke-workspace-audience";
import { logger } from "../../observability/logger";

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
 * key to their resource, so they are deleted here first; the caller holds
 * the demo row lock, which a concurrent notification insert waits for. Call
 * `afterDemoDeleted` once the transaction commits.
 */
export async function deleteDemoWorkspace(
  tx: OutboxTransaction,
  demo: { id: string },
  ownerId: string,
): Promise<DeletedDemo> {
  await deleteResourceNotifications(tx, { workspaceIds: [demo.id] });
  // Uploads made during the tour are removed only if the rows go too.
  await queueStorageCleanup(tx, await listWorkspaceObjectKeys(demo.id, tx));
  // Kind and owner too: this helper never deletes a team workspace.
  await tx
    .delete(workspaceTable)
    .where(
      and(
        eq(workspaceTable.id, demo.id),
        eq(workspaceTable.kind, "demo"),
        eq(workspaceTable.demoOwnerUserId, ownerId),
      ),
    );
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
    logger.error("Failed to publish workspace deleted event", { error });
  });
}
