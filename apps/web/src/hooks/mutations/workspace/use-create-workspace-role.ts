import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createWorkspaceRole,
  type WorkspaceRoleBody,
} from "@/fetchers/workspace/workspace-roles";
import { invalidateWorkspaceWrites } from "@/hooks/queries/workspace/invalidate-workspace-writes";

type CreateWorkspaceRoleRequest = WorkspaceRoleBody & { workspaceId: string };

function useCreateWorkspaceRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ workspaceId, ...body }: CreateWorkspaceRoleRequest) =>
      createWorkspaceRole(workspaceId, body),
    onSuccess: (_data, { workspaceId }) =>
      invalidateWorkspaceWrites(queryClient, workspaceId),
  });
}

export default useCreateWorkspaceRole;
