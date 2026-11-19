import { publishEvent } from "../events";
import { revokeWorkspaceConnections } from "../ws";
import { publishMembersUpdated } from "./publish-members-updated";
import { logger } from "../observability/logger";

/**
 * After the removal commits: live updates and socket revocation, for every
 * removed person; an instance administrator keeps no access. A failure is logged and never fails the
 * committed removal; the socket recheck (every 60 s) closes what this missed.
 */
export async function handleMemberRemoved(removal: {
  workspaceId: string;
  userId: string;
}) {
  const { workspaceId, userId } = removal;
  try {
    await publishEvent("project_members.updated", { workspaceId });
  } catch (error) {
    logger.error("Project members broadcast failed after removal", { error });
  }
  await publishMembersUpdated(workspaceId);
  try {
    await revokeWorkspaceConnections(userId, workspaceId);
  } catch (error) {
    logger.error(
      "Socket revocation failed after removal; the recheck will close it",
      { error },
    );
  }
}
