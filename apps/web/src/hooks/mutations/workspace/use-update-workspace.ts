import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  type UpdateWorkspaceBody,
  updateWorkspace,
} from "@/fetchers/workspace/update-workspace";
import { invalidateWorkspaceWrites } from "@/hooks/queries/workspace/invalidate-workspace-writes";

type UpdateWorkspaceRequest = UpdateWorkspaceBody & { workspaceId: string };

function useUpdateWorkspace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ workspaceId, ...body }: UpdateWorkspaceRequest) =>
      updateWorkspace(workspaceId, body),
    onSuccess: (_data, { workspaceId }) =>
      invalidateWorkspaceWrites(queryClient, workspaceId),
  });
}

export default useUpdateWorkspace;
