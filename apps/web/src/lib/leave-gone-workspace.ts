import type { QueryClient } from "@tanstack/react-query";
import getWorkspaces from "@/fetchers/workspace/get-workspaces";
import { WORKSPACES_QUERY_KEY } from "@/hooks/queries/workspace/workspace-query-keys";
import { evictWorkspaceCache } from "@/lib/evict-workspace-cache";
import { forgetWorkspace } from "@/lib/last-workspace/remembered-workspace";
import { chooseNextWorkspace, type WorkspaceRef } from "@/lib/next-workspace";

export type LeaveDestination =
  | { to: "/dashboard/workspace/$workspaceId"; params: { workspaceId: string } }
  | { to: "/onboarding" }
  | { to: "/dashboard" };

type Deps = {
  queryClient: QueryClient;
  navigate: (destination: LeaveDestination) => unknown;
  /** The signed-in user; their remembered workspace is forgotten. */
  userId: string | undefined;
  /** Test seam. */
  fetchWorkspaces?: () => Promise<readonly WorkspaceRef[]>;
};

/**
 * Leave a workspace that is deleted, archived or revoked. Forgets it as this
 * tab's workspace, drops its cache, and lands on the next workspace's board
 * (its route remembers it) or on onboarding. It never throws: a failed list
 * read falls back to `/dashboard`, which picks the destination again.
 */
export async function leaveGoneWorkspace(
  goneId: string,
  { queryClient, navigate, userId, fetchWorkspaces = getWorkspaces }: Deps,
) {
  if (userId) forgetWorkspace(userId, goneId);
  evictWorkspaceCache(queryClient, goneId);

  let remaining: readonly WorkspaceRef[];
  try {
    remaining = await queryClient.fetchQuery({
      queryKey: WORKSPACES_QUERY_KEY,
      queryFn: fetchWorkspaces,
      staleTime: 0,
    });
  } catch {
    await navigate({ to: "/dashboard" });
    return;
  }

  const next = chooseNextWorkspace(remaining, goneId);
  await navigate(
    next
      ? {
          to: "/dashboard/workspace/$workspaceId",
          params: { workspaceId: next.id },
        }
      : { to: "/onboarding" },
  );
}
