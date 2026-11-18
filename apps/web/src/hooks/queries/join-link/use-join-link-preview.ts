import { useQuery } from "@tanstack/react-query";
import { previewJoinLink } from "@/fetchers/join-link/preview-join-link";
import { joinLinkPreviewKey } from "./keys";

/** Public. A stale answer is wrong for a link that may expire any second. */
export function useJoinLinkPreview(token: string) {
  return useQuery({
    queryKey: joinLinkPreviewKey(token),
    queryFn: () => previewJoinLink(token),
    retry: false,
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: false,
  });
}
