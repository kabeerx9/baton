import { changeWorkspaceMemberRole } from "../../workspace-members/change-workspace-member-role";
import type { AdminAuditRequest } from "../audit/admin-audit-request";
import listWorkspaceMembers from "./list-workspace-members";

async function updateWorkspaceMemberRole(
  request: { workspaceId: string; userId: string; role: string },
  audit: AdminAuditRequest,
) {
  await changeWorkspaceMemberRole({
    ...request,
    actor: { kind: "instance_admin", audit },
  });
  return listWorkspaceMembers(request.workspaceId);
}

export default updateWorkspaceMemberRole;
