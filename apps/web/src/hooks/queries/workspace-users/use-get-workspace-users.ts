import { useQuery } from "@tanstack/react-query";
import getWorkspaceMembers from "@/fetchers/workspace-user/get-workspace-members";
import { workspaceUsersQueryKey } from "@/hooks/queries/workspace/workspace-query-keys";

/** The workspace's members, flat: `{ id, name, email, image, role }`. */
function useGetWorkspaceUsers(workspaceId: string | undefined) {
  return useQuery({
    queryKey: workspaceUsersQueryKey(workspaceId ?? ""),
    queryFn: () => getWorkspaceMembers(workspaceId as string),
    enabled: Boolean(workspaceId),
  });
}

export default useGetWorkspaceUsers;
