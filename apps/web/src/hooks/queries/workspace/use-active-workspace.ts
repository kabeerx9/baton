import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { useEffect } from "react";
import useAuth from "@/components/providers/auth-provider/hooks/use-auth";
import type { Workspace } from "@/fetchers/workspace/types";
import { pickActiveWorkspace } from "@/lib/last-workspace/pick-active-workspace";
import { forgetWorkspace } from "@/lib/last-workspace/remembered-workspace";
import { useRememberedWorkspace } from "@/lib/last-workspace/use-remembered-workspace";
import { deriveActiveWorkspace } from "./derive-active-workspace";
import useGetWorkspaces from "./use-get-workspaces";
import { WORKSPACES_QUERY_KEY } from "./workspace-query-keys";
import { workspaceQueryOptions } from "./workspace-query-options";

/**
 * The workspace the screen is about: the URL's, else this tab's remembered
 * one, else the first. Read with `GET /api/workspace/{id}`, never from the
 * list, because the list leaves out the demo and archived workspaces.
 */
function useActiveWorkspace() {
  const queryClient = useQueryClient();
  const userId = useAuth().user?.id;
  const remembered = useRememberedWorkspace(userId);
  const list = useGetWorkspaces();
  const { workspaceId: routeId } = useParams({
    strict: false,
    select: (params) => ({
      workspaceId:
        "workspaceId" in params && typeof params.workspaceId === "string"
          ? params.workspaceId
          : undefined,
    }),
  });

  const pick = pickActiveWorkspace(routeId, remembered, list.data ?? []);
  const pickedId = pick.kind === "none" ? "" : pick.id;
  const read = useQuery({
    ...workspaceQueryOptions(pickedId),
    enabled: pickedId !== "",
  });

  const state = deriveActiveWorkspace<Workspace>({
    userKnown: Boolean(userId),
    pick,
    list: { isPending: list.isLoading, error: list.error },
    read: { data: read.data, isPending: read.isPending, error: read.error },
  });

  // A remembered or first pick that is refused or archived is not this
  // tab's workspace any more: forget it and pick again. A route id stays;
  // its route redirects or shows the archived screen.
  const stale =
    (state.status === "unavailable" || state.status === "archived") &&
    state.pick.kind !== "route"
      ? state.pick
      : null;
  const staleKind = stale?.kind;
  const staleId = stale?.id;
  useEffect(() => {
    if (!staleKind || !staleId || !userId) return;
    if (staleKind === "remembered") forgetWorkspace(userId, staleId);
    else void queryClient.invalidateQueries({ queryKey: WORKSPACES_QUERY_KEY });
  }, [staleKind, staleId, userId, queryClient]);

  return {
    state,
    data: state.status === "ready" ? state.workspace : undefined,
    error: state.status === "error" ? (state.error as Error) : null,
    // A stale pick is about to be replaced, so it reads as loading.
    isLoading: state.status === "loading" || stale !== null,
    isError: state.status === "error",
  };
}

export default useActiveWorkspace;
