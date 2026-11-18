import { useMutation, useQueryClient } from "@tanstack/react-query";
import { transferWorkspaceOwnership } from "@/fetchers/workspace/transfer-workspace-ownership";
import { invalidateWorkspaceWrites } from "@/hooks/queries/workspace/invalidate-workspace-writes";

type TransferOwnershipRequest = { workspaceId: string; newOwnerUserId: string };

/** One atomic route: no window with two owners or none. */
function useTransferWorkspaceOwnership() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ workspaceId, newOwnerUserId }: TransferOwnershipRequest) =>
      transferWorkspaceOwnership(workspaceId, newOwnerUserId),
    onSuccess: (_data, { workspaceId }) =>
      invalidateWorkspaceWrites(queryClient, workspaceId),
  });
}

export default useTransferWorkspaceOwnership;
