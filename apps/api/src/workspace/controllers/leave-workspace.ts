import { and, eq } from "drizzle-orm";
import db, { schema } from "../../database";
import { publishEvent } from "../../events";
import { clearMemberRemoval } from "../../join-link/record-member-removal";
import { clearMemberProjectAccess } from "../../project-access/clear-member-project-access";
import { isOwnerRole } from "../../project-access/is-owner-role";
import { revokeWorkspaceConnections } from "../../ws";
import { publishMembersUpdated } from "../../workspace-members/publish-members-updated";
import { lockWorkspace } from "../lifecycle/lock-workspace";
import { authorizeWorkspaceWrite } from "../write/authorize-workspace-write";
import type { WorkspaceActor } from "../write/workspace-actor";
import { onlyOwnerError } from "../write/write-errors";
import { logger } from "../../observability/logger";

/**
 * The caller leaves. Under the workspace lock, so a leave and a removal of
 * the same person never interleave (BOARD.md, join links).
 */
async function leaveWorkspace(input: {
  workspaceId: string;
  actor: Extract<WorkspaceActor, { kind: "member" }>;
}) {
  const { workspaceId, actor } = input;
  await db.transaction(async (tx) => {
    const locked = await lockWorkspace(tx, workspaceId, { allowDemo: true });
    const member = await authorizeWorkspaceWrite(tx, locked, actor, {
      permissions: {},
      apiKeyScope: { workspace: ["manage_settings"] },
    });
    if (
      isOwnerRole(member!.role) &&
      locked.members.filter((row) => isOwnerRole(row.role)).length === 1
    )
      throw onlyOwnerError(
        "Transfer ownership to another member before you leave",
      );
    // A leave is the person's last exit: links made before an earlier
    // removal admit them again.
    await clearMemberRemoval(tx, workspaceId, actor.userId);
    await tx
      .delete(schema.workspaceUserTable)
      .where(
        and(
          eq(schema.workspaceUserTable.workspaceId, workspaceId),
          eq(schema.workspaceUserTable.userId, actor.userId),
        ),
      );
    await clearMemberProjectAccess(workspaceId, actor.userId, tx);
  });

  await publishEvent("project_members.updated", { workspaceId });
  await publishMembersUpdated(workspaceId);
  try {
    await revokeWorkspaceConnections(actor.userId, workspaceId);
  } catch (error) {
    // The leave is committed; the socket recheck (every 60 s) closes it.
    logger.error("Socket revocation failed after leave", { error });
  }
  return { workspaceId };
}

export default leaveWorkspace;
