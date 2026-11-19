import { publishEvent } from "../events";
import { logger } from "../observability/logger";

/**
 * After a member change commits: everyone who may hold a connection to the
 * workspace refetches its members and their own capabilities
 * (`WORKSPACE_MEMBERS_UPDATED`). Live only; a missed delivery is caught by
 * the next refetch. Never fails the committed change.
 */
export async function publishMembersUpdated(workspaceId: string) {
  try {
    await publishEvent("workspace.members_updated", { workspaceId });
  } catch (error) {
    logger.error("Workspace members broadcast failed", { error });
  }
}
