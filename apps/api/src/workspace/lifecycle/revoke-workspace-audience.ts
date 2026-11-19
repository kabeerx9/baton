import { revokeWorkspaceConnections } from "../../ws";
import { logger } from "../../observability/logger";

/** Closes the workspace's realtime connections for every listed user. */
export async function revokeWorkspaceAudience(
  userIds: string[],
  workspaceId: string,
  reason?: "archived",
) {
  await Promise.all(
    userIds.map((userId) =>
      revokeWorkspaceConnections(userId, workspaceId, {
        force: true,
        reason,
      }).catch((error) => {
        logger.error("Failed to revoke workspace realtime access", { error });
      }),
    ),
  );
}
