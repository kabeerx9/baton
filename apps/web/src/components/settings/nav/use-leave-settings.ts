import { useNavigate } from "@tanstack/react-router";
import { useCallback, useMemo } from "react";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";
import useGetWorkspaces from "@/hooks/queries/workspace/use-get-workspaces";
import { resolveLeaveTarget } from "@/lib/next-workspace";

// Returns undefined only while the workspace list loads. Otherwise "back"
// always leads somewhere valid: the active workspace, the first one, or onboarding.
export function useLeaveSettings() {
  const navigate = useNavigate();
  const { data: workspace } = useActiveWorkspace();
  const { data: workspaces, isError } = useGetWorkspaces();
  const activeId = workspace?.id;

  const target = useMemo(
    () => resolveLeaveTarget({ activeId, workspaces }),
    [activeId, workspaces],
  );

  const leave = useCallback(() => {
    if (target.kind === "workspace") {
      void navigate({
        to: "/dashboard/workspace/$workspaceId",
        params: { workspaceId: target.workspaceId },
      });
    } else {
      // "/dashboard" re-derives the destination, including onboarding.
      void navigate({
        to: target.kind === "onboarding" ? "/onboarding" : "/dashboard",
      });
    }
  }, [navigate, target]);

  // A failed list read is not a reason to trap the user.
  return target.kind === "loading" && !isError ? undefined : leave;
}
