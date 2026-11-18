import { useQuery } from "@tanstack/react-query";
import { getJoinLink } from "@/fetchers/join-link/get-join-link";
import { joinLinkKey } from "./keys";

/** The workspace's one non-revoked join link, or null. Admins only. */
export function useJoinLink(workspaceId: string, enabled: boolean) {
  return useQuery({
    queryKey: joinLinkKey(workspaceId),
    queryFn: () => getJoinLink(workspaceId),
    enabled,
  });
}
