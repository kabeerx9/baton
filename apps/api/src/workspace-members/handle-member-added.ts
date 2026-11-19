import { publishMemberProjects } from "../project-access/publish-member-projects";
import { logger } from "../observability/logger";

export async function handleMemberAdded(workspaceId: string, userId: string) {
  await publishMemberProjects(workspaceId, userId).catch((error) => {
    logger.error("Project member refresh failed", { error });
  });
}
