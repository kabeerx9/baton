import { classifyWorkspaceReadError } from "@/hooks/queries/workspace/workspace-read-error";

export type WorkspaceRouteEntry =
  | { status: "ready" }
  /** The archived screen renders under the route. */
  | { status: "archived" }
  /**
   * Not a member, or gone: leave for `/dashboard`, never another workspace.
   * An instance admin who is not a member reads the workspace (`role: null`)
   * but works in it through `/api/admin/*`, so the board refuses them too.
   */
  | { status: "refused" }
  | { status: "failed"; error: unknown };

/**
 * The URL names the workspace. Its own read decides whether anything under
 * the route renders; no other workspace ever stands in for it.
 */
export async function enterWorkspaceRoute(
  read: () => Promise<{ role: string | null }>,
): Promise<WorkspaceRouteEntry> {
  try {
    const workspace = await read();
    return workspace.role === null
      ? { status: "refused" }
      : { status: "ready" };
  } catch (error) {
    const kind = classifyWorkspaceReadError(error);
    if (kind === "archived") return { status: "archived" };
    if (kind === "forbidden") return { status: "refused" };
    return { status: "failed", error };
  }
}
