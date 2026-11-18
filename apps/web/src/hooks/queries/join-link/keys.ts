export const joinLinkKey = (workspaceId: string) =>
  ["join-link", workspaceId] as const;

export const joinLinkPreviewKey = (token: string) =>
  ["join-link-preview", token] as const;

/** What a member event (join, removal, role change) makes stale. */
export const membersUpdatedKeys = (workspaceId: string) =>
  [
    ["workspace", workspaceId],
    ["workspace-users", workspaceId],
    ["workspace-capabilities", workspaceId],
    joinLinkKey(workspaceId),
    ["workspaces"],
  ] as const;
