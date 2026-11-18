import { publishEvent } from "../events";
import { hasInstanceAdminRole } from "../utils/instance-admin-role";
import { revokeWorkspaceConnections } from "../ws";

/** After the removal commits: live updates and socket revocation. */
export async function handleMemberRemoved(removal: {
  workspaceId: string;
  userId: string;
  userRole: string | null | undefined;
}) {
  const { workspaceId, userId, userRole } = removal;
  await publishEvent("project_members.updated", { workspaceId });
  if (!hasInstanceAdminRole(userRole)) {
    await revokeWorkspaceConnections(userId, workspaceId, {
      role: userRole ?? null,
    });
  }
}
