export type WorkspaceRef = { id: string; kind?: string | null };

/** The workspace to move to when `goneId` is no longer usable. */
export function chooseNextWorkspace<T extends WorkspaceRef>(
  workspaces: readonly T[] | null | undefined,
  goneId?: string,
): T | undefined {
  return workspaces?.find(
    (workspace) => workspace.id !== goneId && workspace.kind !== "demo",
  );
}

export type LeaveTarget =
  | { kind: "loading" }
  | { kind: "workspace"; workspaceId: string }
  | { kind: "onboarding" };

type LeaveInput = {
  activeId: string | undefined;
  /** `undefined` while the workspace list is still loading. */
  workspaces: readonly WorkspaceRef[] | undefined;
};

/**
 * Where "back" from settings leads. Only a missing list is `loading`; an
 * active workspace that is not in the list (deleted, revoked) is not trusted.
 */
export function resolveLeaveTarget({
  activeId,
  workspaces,
}: LeaveInput): LeaveTarget {
  if (!workspaces) return { kind: "loading" };
  const active = workspaces.find(
    (workspace) => workspace.id === activeId && workspace.kind !== "demo",
  );
  const next = active ?? chooseNextWorkspace(workspaces);
  return next
    ? { kind: "workspace", workspaceId: next.id }
    : { kind: "onboarding" };
}
