import type { QueryClient } from "@tanstack/react-query";
import getWorkspaces from "@/fetchers/workspace/get-workspaces";
import {
  ACTIVE_ORGANIZATION_QUERY_KEY,
  WORKSPACES_QUERY_KEY,
} from "@/hooks/queries/workspace/workspace-query-keys";
import { authClient } from "@/lib/auth-client";
import { evictWorkspaceCache } from "@/lib/evict-workspace-cache";
import { chooseNextWorkspace, type WorkspaceRef } from "@/lib/next-workspace";

export type LeaveDestination =
  | { to: "/dashboard/workspace/$workspaceId"; params: { workspaceId: string } }
  | { to: "/onboarding" }
  | { to: "/dashboard" };

type Deps = {
  queryClient: QueryClient;
  navigate: (destination: LeaveDestination) => unknown;
  /** Test seams. */
  fetchWorkspaces?: () => Promise<readonly WorkspaceRef[]>;
  setActive?: (workspaceId: string | null) => Promise<unknown>;
};

const defaultSetActive = (workspaceId: string | null) =>
  authClient.organization.setActive({ organizationId: workspaceId });

/**
 * Leave a workspace that is deleted, archived or revoked. Picks the next
 * workspace, makes it the session's active one before navigating (so no screen
 * reads the gone workspace as active), drops the gone workspace's cache, and
 * lands on its board or on onboarding. It never throws: a failed step falls
 * back to `/dashboard`, which re-derives the destination.
 */
export async function leaveGoneWorkspace(
  goneId: string,
  {
    queryClient,
    navigate,
    fetchWorkspaces = getWorkspaces,
    setActive = defaultSetActive,
  }: Deps,
) {
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
  try {
    const result = await setActive(next?.id ?? null);
    const error = (result as { error?: unknown } | null)?.error;
    if (error) throw error;
  } catch {
    await navigate({ to: "/dashboard" });
    return;
  }

  void queryClient.invalidateQueries({
    queryKey: ACTIVE_ORGANIZATION_QUERY_KEY,
  });
  await navigate(
    next
      ? {
          to: "/dashboard/workspace/$workspaceId",
          params: { workspaceId: next.id },
        }
      : { to: "/onboarding" },
  );
}
