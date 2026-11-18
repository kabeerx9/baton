type Result<T> = { data: T | undefined; isPending: boolean; error: unknown };

export type ActiveWorkspaceState<W> =
  | { status: "loading" }
  | { status: "none" }
  | { status: "error"; error: unknown }
  | { status: "ready"; workspace: W };

type Input<W extends { id: string }, A extends W> = {
  routeWorkspaceId: string | undefined;
  list: Result<readonly W[]>;
  /** `data: null` means the session has no active workspace. */
  active: Omit<Result<A | null>, "data"> & { data: A | null | undefined };
};

/**
 * The workspace the screen is about: the one in the URL when it is in the
 * user's list, else the session's active one. One pure function, so "none"
 * (nothing active) is never confused with "loading".
 */
export function deriveActiveWorkspace<W extends { id: string }, A extends W>({
  routeWorkspaceId,
  list,
  active,
}: Input<W, A>): ActiveWorkspaceState<W> {
  const fromRoute = routeWorkspaceId
    ? list.data?.find((workspace) => workspace.id === routeWorkspaceId)
    : undefined;
  if (fromRoute) return { status: "ready", workspace: fromRoute };
  if (routeWorkspaceId && list.isPending) return { status: "loading" };
  if (active.data) return { status: "ready", workspace: active.data };
  if (active.error) return { status: "error", error: active.error };
  if (active.isPending) return { status: "loading" };
  return { status: "none" };
}
