export const joinLinkKey = (workspaceId: string) =>
  ["join-link", workspaceId] as const;

export const joinLinkPreviewKey = (token: string) =>
  ["join-link-preview", token] as const;

/** What a "someone joined this workspace" event makes stale. */
export const membersUpdatedKeys = (workspaceId: string) =>
  [
    ["workspace", "full", workspaceId],
    ["workspace-users", workspaceId],
    joinLinkKey(workspaceId),
    ["workspaces"],
  ] as const;
