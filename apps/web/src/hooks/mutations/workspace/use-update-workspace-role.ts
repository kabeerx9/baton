import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateWorkspaceRole } from "@/fetchers/workspace/workspace-roles";
import { invalidateWorkspaceWrites } from "@/hooks/queries/workspace/invalidate-workspace-writes";

type UpdateWorkspaceRoleRequest = {
  workspaceId: string;
  roleId: string;
  permission: Record<string, string[]>;
};

function useUpdateWorkspaceRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      workspaceId,
      roleId,
      permission,
    }: UpdateWorkspaceRoleRequest) =>
      updateWorkspaceRole(workspaceId, roleId, { permission }),
    // Members holding this role now have other capabilities.
    onSuccess: (_data, { workspaceId }) =>
      invalidateWorkspaceWrites(queryClient, workspaceId),
  });
}

export default useUpdateWorkspaceRole;
