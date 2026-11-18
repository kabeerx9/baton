import { transferWorkspaceOwnership as transferOwnership } from "../../workspace-members/transfer-workspace-ownership";
import type { AdminAuditRequest } from "../audit/admin-audit-request";
import listWorkspaceMembers from "./list-workspace-members";

async function transferWorkspaceOwnership(
  request: { workspaceId: string; userId: string },
  audit: AdminAuditRequest,
) {
  await transferOwnership({
    ...request,
    actor: { kind: "instance_admin", audit },
  });
  return listWorkspaceMembers(request.workspaceId);
}

export default transferWorkspaceOwnership;
