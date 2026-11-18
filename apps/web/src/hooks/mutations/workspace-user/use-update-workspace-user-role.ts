import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateWorkspaceMemberRole } from "@/fetchers/workspace-user/workspace-member-writes";
import { invalidateWorkspaceWrites } from "@/hooks/queries/workspace/invalidate-workspace-writes";

type UpdateWorkspaceUserRoleRequest = {
  workspaceId: string;
  userId: string;
  role: string;
};

function useUpdateWorkspaceUserRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      workspaceId,
      userId,
      role,
    }: UpdateWorkspaceUserRoleRequest) =>
      updateWorkspaceMemberRole(workspaceId, userId, role),
    // The caller's own role may change, and with it `["workspace", id]`.
    onSuccess: (_data, { workspaceId }) =>
      invalidateWorkspaceWrites(queryClient, workspaceId),
  });
}

export default useUpdateWorkspaceUserRole;
