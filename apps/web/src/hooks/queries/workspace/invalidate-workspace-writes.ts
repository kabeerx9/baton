import type { QueryClient } from "@tanstack/react-query";
import { workspaceWriteKeys } from "./workspace-query-keys";

/** After any workspace, member or role write: refetch what it can change. */
export function invalidateWorkspaceWrites(
  queryClient: QueryClient,
  workspaceId: string,
) {
  return Promise.all(
    workspaceWriteKeys(workspaceId).map((queryKey) =>
      queryClient.invalidateQueries({ queryKey }),
    ),
  );
}
