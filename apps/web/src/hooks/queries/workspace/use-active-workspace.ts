import { useParams } from "@tanstack/react-router";
import useActiveOrganization from "./use-active-organization";
import { deriveActiveWorkspace } from "./derive-active-workspace";
import useGetWorkspaces from "./use-get-workspaces";

function useActiveWorkspace() {
  const { data: activeOrganization, ...active } = useActiveOrganization();
  const { data: organizations, isLoading: isListPending } = useGetWorkspaces();
  const { workspaceId } = useParams({
    strict: false,
    select: (params) => ({
      workspaceId:
        "workspaceId" in params && typeof params.workspaceId === "string"
          ? params.workspaceId
          : undefined,
    }),
  });

  const state = deriveActiveWorkspace({
    routeWorkspaceId: workspaceId,
    list: { data: organizations, isPending: isListPending, error: null },
    active: {
      data: activeOrganization,
      isPending: active.isPending,
      error: active.error,
    },
  });

  return {
    state,
    data: state.status === "ready" ? state.workspace : undefined,
    error: state.status === "error" ? (state.error as Error) : null,
    isLoading: state.status === "loading",
    isError: state.status === "error",
  };
}

export default useActiveWorkspace;
