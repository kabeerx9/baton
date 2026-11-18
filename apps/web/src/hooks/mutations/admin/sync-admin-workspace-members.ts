import type { QueryClient } from "@tanstack/react-query";
import type { AdminWorkspaceMember } from "@/fetchers/admin/workspace-types";
import { adminWorkspaceMembersQueryKey } from "@/hooks/queries/admin/use-admin-workspace-members";
import { ADMIN_WORKSPACES_QUERY_KEY } from "@/hooks/queries/admin/use-admin-workspaces";

export function syncAdminWorkspaceMembers(
  queryClient: QueryClient,
  workspaceId: string,
  members: AdminWorkspaceMember[],
) {
  queryClient.setQueryData(adminWorkspaceMembersQueryKey(workspaceId), members);
  queryClient.invalidateQueries({ queryKey: ADMIN_WORKSPACES_QUERY_KEY });
  queryClient.invalidateQueries({ queryKey: ["workspace-users", workspaceId] });
  // The admin may be a member: their own role is in the workspace read.
  queryClient.invalidateQueries({ queryKey: ["workspace", workspaceId] });
}
