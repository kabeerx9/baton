import { useMutation } from "@tanstack/react-query";
import { deleteWorkspace } from "@/fetchers/workspace/delete-workspace";

/** The caller leaves the deleted workspace with `leaveGoneWorkspace`. */
function useDeleteWorkspace() {
  return useMutation({
    mutationFn: ({ workspaceId }: { workspaceId: string }) =>
      deleteWorkspace(workspaceId),
  });
}

export default useDeleteWorkspace;
