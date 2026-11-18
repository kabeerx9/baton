import {
  WORKSPACE_CAPABILITY_NAMES,
  type WorkspaceCapability,
} from "@baton/permissions";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import getMyCapabilities from "@/fetchers/workspace/get-my-capabilities";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";

// Capabilities are named permission bundles (see `workspaceCapabilities` in
// @baton/permissions). The server evaluates all of them in one request with
// the same rules it enforces, so custom workspace roles work in the UI: the
// local `checkRolePermission` only knows the static roles compiled into the
// auth client.
type CapabilityMap = Record<WorkspaceCapability, boolean>;

function emptyCapabilityMap(): CapabilityMap {
  const out = {} as CapabilityMap;
  for (const key of WORKSPACE_CAPABILITY_NAMES) {
    out[key] = false;
  }
  return out;
}

export function useWorkspacePermission() {
  const { data: activeWorkspace } = useActiveWorkspace();
  const workspaceId = activeWorkspace?.id;
  // The tour's demo workspace is deleted by the tour itself. Hiding the
  // delete actions is a hint; the API stays the authority.
  const isDemo = activeWorkspace?.kind === "demo";
  // `GET /api/workspace/{id}` carries the caller's role, so a role change
  // invalidates one query, not a member list.
  const role = activeWorkspace?.role ?? undefined;

  // Cached by (workspaceId, role). Refetches when either changes, e.g., when
  // the admin edits the role's permissions in the Roles UI and we invalidate
  // this key.
  const {
    data: capabilities,
    isLoading,
    isError,
    isFetching,
  } = useQuery({
    queryKey: ["workspace-capabilities", workspaceId, role],
    enabled: Boolean(workspaceId && role),
    staleTime: 5 * 60 * 1000,
    queryFn: (): Promise<CapabilityMap> =>
      getMyCapabilities(workspaceId as string),
  });

  const can: CapabilityMap = capabilities ?? emptyCapabilityMap();

  const helpers = useMemo(() => {
    return {
      canManageProjects: () => can.manageProjects,
      canCreateProjects: () => can.createProjects,
      canUpdateProjects: () => can.updateProjects,
      canShareProjects: () => can.shareProjects,
      canDeleteProjects: () => !isDemo && can.deleteProjects,
      canUpdateTasks: () => can.updateTasks,
      canCreateTasks: () => can.createTasks,
      canDeleteTasks: () => !isDemo && can.deleteTasks,
      canAssignTasks: () => can.assignTasks,
      canCreateLabels: () => can.createLabels,
      canUpdateLabels: () => can.updateLabels,
      canDeleteLabels: () => can.deleteLabels,
      canManageWorkspace: () => can.manageWorkspace,
      canManageSettings: () => can.manageSettings,
      canDeleteWorkspace: () => !isDemo && can.deleteWorkspace,
      canInviteUsers: () => can.inviteUsers,
      canManageTeam: () => can.manageTeam,
      canUpdateMembers: () => can.updateMembers,
      canRemoveMembers: () => can.removeMembers,
    };
  }, [can, isDemo]);

  return {
    ...helpers,
    workspace: activeWorkspace,
    role,
    isOwner: role === "owner",
    isAdmin: role === "owner" || role === "admin",
    // True while the first capability fetch is in flight. Useful for hiding
    // action UI during the initial render instead of flashing it on then
    // off when the server check resolves. A failed check settles to
    // "nothing allowed" instead of loading forever.
    isCheckingPermissions:
      Boolean(workspaceId && role) &&
      (isLoading || (!capabilities && !isError)),
    isRefetchingPermissions: isFetching,
  };
}
