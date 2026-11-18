import { useMutation, useQueryClient } from "@tanstack/react-query";
import { revokeJoinLink } from "@/fetchers/join-link/revoke-join-link";
import { joinLinkKey } from "@/hooks/queries/join-link/keys";

export function useRevokeJoinLink(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => revokeJoinLink(workspaceId),
    onSuccess: () => queryClient.setQueryData(joinLinkKey(workspaceId), null),
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: joinLinkKey(workspaceId) }),
  });
}
