import type { WorkspaceCapability } from "@baton/permissions";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import getMyCapabilities from "@/fetchers/workspace/get-my-capabilities";

// `useWorkspacePermission` answers for the active workspace. This asks the
// capabilities endpoint about a set of other workspaces instead, which is
// what the project move needs: the source workspace and the targets.
//
// Pass a module-level constant for `capabilities` so its identity is stable.
// A workspace is allowed when every named capability is granted.
export function useWorkspacesWithPermission(
  workspaceIds: string[],
  capabilities: readonly WorkspaceCapability[],
) {
  const ids = useMemo(() => [...workspaceIds].sort(), [workspaceIds]);

  const { data, isPending, isError } = useQuery({
    queryKey: ["workspace-capabilities", "by-capability", capabilities, ids],
    enabled: ids.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      // Deliberately not caught per workspace: swallowing a failed check as
      // "no permission" is indistinguishable from a real denial, so a
      // transient error would silently hide the action instead of retrying.
      const results = await Promise.all(
        ids.map(async (workspaceId) => {
          const granted = await getMyCapabilities(workspaceId);
          return capabilities.every((name) => granted[name])
            ? workspaceId
            : null;
        }),
      );
      return results.filter((id): id is string => id !== null);
    },
  });

  const allowed = useMemo(() => new Set(data ?? []), [data]);

  return {
    allowed,
    // False while disabled, so callers don't read an empty set as "loading".
    isPending: ids.length > 0 && isPending,
    isError,
  };
}
