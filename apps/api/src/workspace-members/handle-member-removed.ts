import { publishEvent } from "../events";
import { hasInstanceAdminRole } from "../utils/instance-admin-role";
import { revokeWorkspaceConnections } from "../ws";
import { publishMembersUpdated } from "./publish-members-updated";
import { logger } from "../observability/logger";

/**
 * After the removal commits: live updates and socket revocation. The
 * instance role was read inside the removal's transaction, so nothing here
 * reads the database first. A failure is logged and never fails the
 * committed removal; the socket recheck (every 60 s) closes what this missed.
 */
export async function handleMemberRemoved(removal: {
  workspaceId: string;
  userId: string;
  userRole: string | null;
}) {
  const { workspaceId, userId, userRole } = removal;
  try {
    await publishEvent("project_members.updated", { workspaceId });
  } catch (error) {
    logger.error("Project members broadcast failed after removal", { error });
  }
  await publishMembersUpdated(workspaceId);
  if (hasInstanceAdminRole(userRole)) return;
  try {
    await revokeWorkspaceConnections(userId, workspaceId, { role: userRole });
  } catch (error) {
    logger.error(
      "Socket revocation failed after removal; the recheck will close it",
      { error },
    );
  }
}
