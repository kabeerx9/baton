import { queryOptions } from "@tanstack/react-query";
import getWorkspace from "@/fetchers/workspace/get-workspace";
import { workspaceQueryKey } from "./workspace-query-keys";
import { isWorkspaceUnavailable } from "./workspace-read-error";

/**
 * One read for "this workspace": the route guard, the active workspace and
 * the archived screen share it. A refusal is final, so it is not retried.
 */
export const workspaceQueryOptions = (workspaceId: string) =>
  queryOptions({
    queryKey: workspaceQueryKey(workspaceId),
    queryFn: () => getWorkspace(workspaceId),
    retry: (count, error) => !isWorkspaceUnavailable(error) && count < 2,
    staleTime: 5 * 60 * 1000,
  });
