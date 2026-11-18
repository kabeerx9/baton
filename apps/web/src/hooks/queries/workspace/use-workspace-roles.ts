import { useQuery } from "@tanstack/react-query";
import { getWorkspaceRoles } from "@/fetchers/workspace/workspace-roles";
import { workspaceRolesQueryKey } from "./workspace-query-keys";

export type { WorkspaceRole } from "@/fetchers/workspace/types";

function useWorkspaceRoles(workspaceId: string | undefined) {
  return useQuery({
    queryKey: workspaceRolesQueryKey(workspaceId ?? ""),
    enabled: Boolean(workspaceId),
    queryFn: () => getWorkspaceRoles(workspaceId as string),
  });
}

export default useWorkspaceRoles;
