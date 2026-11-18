import { useMutation, useQueryClient } from "@tanstack/react-query";
import { removeWorkspaceMember } from "@/fetchers/workspace-user/workspace-member-writes";
import { invalidateWorkspaceWrites } from "@/hooks/queries/workspace/invalidate-workspace-writes";

type DeleteWorkspaceUserRequest = { workspaceId: string; userId: string };

function useDeleteWorkspaceUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ workspaceId, userId }: DeleteWorkspaceUserRequest) =>
      removeWorkspaceMember(workspaceId, userId),
    onSuccess: (_data, { workspaceId }) =>
      invalidateWorkspaceWrites(queryClient, workspaceId),
  });
}

export default useDeleteWorkspaceUser;
