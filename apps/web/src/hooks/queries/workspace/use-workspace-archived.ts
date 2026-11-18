import { useQuery } from "@tanstack/react-query";
import { isWorkspaceArchivedError } from "@/lib/is-workspace-archived-error";
import { workspaceQueryOptions } from "./workspace-query-options";

/**
 * Whether the workspace in the URL was archived by an instance administrator.
 * Pages keep rendering while this loads so boards are never held back.
 */
function useWorkspaceArchived(workspaceId: string) {
  const { error } = useQuery(workspaceQueryOptions(workspaceId));
  return isWorkspaceArchivedError(error);
}

export default useWorkspaceArchived;
