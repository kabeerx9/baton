import { classifyWorkspaceReadError } from "@/hooks/queries/workspace/workspace-read-error";

export type WorkspaceRouteEntry =
  | { status: "ready" }
  /** The archived screen renders under the route. */
  | { status: "archived" }
  /** Not a member, or gone: leave for `/dashboard`, never another workspace. */
  | { status: "refused" }
  | { status: "failed"; error: unknown };

/**
 * The URL names the workspace. Its own read decides whether anything under
 * the route renders; no other workspace ever stands in for it.
 */
export async function enterWorkspaceRoute(
  read: () => Promise<unknown>,
): Promise<WorkspaceRouteEntry> {
  try {
    await read();
    return { status: "ready" };
  } catch (error) {
    const kind = classifyWorkspaceReadError(error);
    if (kind === "archived") return { status: "archived" };
    if (kind === "forbidden") return { status: "refused" };
    return { status: "failed", error };
  }
}
