import { useMutation, useQueryClient } from "@tanstack/react-query";
import { joinWorkspace } from "@/fetchers/join-link/join-workspace";
import { WORKSPACES_QUERY_KEY } from "@/hooks/queries/workspace/workspace-query-keys";

/**
 * Joins through the API. The caller opens the workspace by navigating to its
 * route, which remembers it for this tab.
 */
export function useJoinWorkspace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (token: string) => joinWorkspace(token),
    // The tour gate and the workspace switcher read this list.
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: WORKSPACES_QUERY_KEY }),
  });
}
