import { removeWorkspaceMember as removeMember } from "../../workspace-members/remove-workspace-member";
import type { AdminAuditRequest } from "../audit/admin-audit-request";
import listWorkspaceMembers from "./list-workspace-members";

async function removeWorkspaceMember(
  request: { workspaceId: string; userId: string },
  audit: AdminAuditRequest,
) {
  await removeMember({ ...request, actor: { kind: "instance_admin", audit } });
  return listWorkspaceMembers(request.workspaceId);
}

export default removeWorkspaceMember;
