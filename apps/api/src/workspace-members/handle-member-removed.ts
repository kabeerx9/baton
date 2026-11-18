import * as Sentry from "@sentry/node";
import { sql } from "drizzle-orm";
import db from "../database";
import { workspaceMemberRemovalTable } from "../database/schema";
import { publishEvent } from "../events";
import { clearMemberProjectAccess } from "../project-access/clear-member-project-access";
import { hasInstanceAdminRole } from "../utils/instance-admin-role";
import { revokeWorkspaceConnections } from "../ws";

export async function handleMemberRemoved(removal: {
  workspaceId: string;
  userId: string;
  userRole: string | null | undefined;
}) {
  const { workspaceId, userId, userRole } = removal;
  await recordRemoval(workspaceId, userId);
  await clearMemberProjectAccess(workspaceId, userId).catch((error) => {
    console.error("Project access cleanup failed:", error);
  });
  await publishEvent("project_members.updated", { workspaceId });
  if (!hasInstanceAdminRole(userRole)) {
    await revokeWorkspaceConnections(userId, workspaceId, {
      role: userRole ?? null,
    });
  }
}

/**
 * Join links made before this moment refuse the person (join-link). Same
 * clock as the link's created_at. A failure is reported and the removal
 * cleanup still runs: connections must be revoked.
 */
async function recordRemoval(workspaceId: string, userId: string) {
  try {
    await db
      .insert(workspaceMemberRemovalTable)
      .values({ workspaceId, userId })
      .onConflictDoUpdate({
        target: [
          workspaceMemberRemovalTable.workspaceId,
          workspaceMemberRemovalTable.userId,
        ],
        set: { removedAt: sql`(now() AT TIME ZONE 'utc')` },
      });
  } catch (error) {
    console.error("Recording a workspace removal failed:", error);
    Sentry.captureException(error);
  }
}
