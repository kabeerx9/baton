import type { QueryClient } from "@tanstack/react-query";

const mentions = (queryKey: readonly unknown[], workspaceId: string) =>
  queryKey.includes(workspaceId);

/**
 * The demo workspace is gone for good once the tour ends. Drop every cache
 * entry keyed by it, so no mounted or reopened view asks the API about a
 * workspace that no longer exists. Call it after the demo page has unmounted:
 * removing an active query makes its observer start a fresh request.
 */
export function dropDemoWorkspaceQueries(
  queryClient: QueryClient,
  workspaceId: string,
) {
  void queryClient.cancelQueries({
    predicate: (query) => mentions(query.queryKey, workspaceId),
  });
  queryClient.removeQueries({
    predicate: (query) => mentions(query.queryKey, workspaceId),
  });
}
