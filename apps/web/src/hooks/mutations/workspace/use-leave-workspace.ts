import { useMutation } from "@tanstack/react-query";
import { leaveWorkspace } from "@/fetchers/workspace/leave-workspace";

/** The caller lands elsewhere with `leaveGoneWorkspace`. */
function useLeaveWorkspace() {
  return useMutation({
    mutationFn: ({ workspaceId }: { workspaceId: string }) =>
      leaveWorkspace(workspaceId),
  });
}

export default useLeaveWorkspace;
