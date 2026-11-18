import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createJoinLink } from "@/fetchers/join-link/create-join-link";
import type { CreateJoinLinkInput } from "@/fetchers/join-link/types";
import { joinLinkKey } from "@/hooks/queries/join-link/keys";
import { track } from "@/lib/analytics/track";

/** Creates a link. The server revokes the previous one in the same call. */
export function useCreateJoinLink(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateJoinLinkInput) =>
      createJoinLink(workspaceId, input),
    onSuccess: (link) => {
      // The POST is the only response that always carries the URL.
      queryClient.setQueryData(joinLinkKey(workspaceId), link);
      track("Join Link Created");
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: joinLinkKey(workspaceId) }),
  });
}
