/** The workspaces the user belongs to (demo and archived excluded by the API). */
export const WORKSPACES_QUERY_KEY = ["workspaces"] as const;
/** One workspace with the caller's role: `GET /api/workspace/{id}`. */
export const workspaceQueryKey = (workspaceId: string) =>
  ["workspace", workspaceId] as const;
/** The flat member list of one workspace. */
export const workspaceUsersQueryKey = (workspaceId: string) =>
  ["workspace-users", workspaceId] as const;
export const workspaceRolesQueryKey = (workspaceId: string) =>
  ["workspace-roles", workspaceId] as const;
export const workspaceCapabilitiesQueryKey = (workspaceId: string) =>
  ["workspace-capabilities", workspaceId] as const;

/** Every cache a member, role or workspace write in `workspaceId` makes stale. */
export const workspaceWriteKeys = (workspaceId: string) =>
  [
    WORKSPACES_QUERY_KEY,
    workspaceQueryKey(workspaceId),
    workspaceUsersQueryKey(workspaceId),
    workspaceRolesQueryKey(workspaceId),
    workspaceCapabilitiesQueryKey(workspaceId),
  ] as const;
