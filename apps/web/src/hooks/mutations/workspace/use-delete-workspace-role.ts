import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteWorkspaceRole } from "@/fetchers/workspace/workspace-roles";
import { invalidateWorkspaceWrites } from "@/hooks/queries/workspace/invalidate-workspace-writes";

type DeleteWorkspaceRoleRequest = { workspaceId: string; roleId: string };

function useDeleteWorkspaceRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ workspaceId, roleId }: DeleteWorkspaceRoleRequest) =>
      deleteWorkspaceRole(workspaceId, roleId),
    onSuccess: (_data, { workspaceId }) =>
      invalidateWorkspaceWrites(queryClient, workspaceId),
  });
}

export default useDeleteWorkspaceRole;
