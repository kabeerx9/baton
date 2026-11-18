import type { WorkspacePick } from "@/lib/last-workspace/pick-active-workspace";
import { classifyWorkspaceReadError } from "./workspace-read-error";

type Read<T> = { data: T | undefined; isPending: boolean; error: unknown };

export type ActiveWorkspaceState<W> =
  | { status: "loading" }
  | { status: "none" }
  | { status: "ready"; workspace: W }
  | { status: "archived"; pick: WorkspacePick & { id: string } }
  /** 403 or 404: not a member, or the workspace is gone. */
  | { status: "unavailable"; pick: WorkspacePick & { id: string } }
  | { status: "error"; error: unknown };

type Input<W> = {
  /** False until the signed-in user is known: the remembered id needs it. */
  userKnown: boolean;
  pick: WorkspacePick;
  list: Omit<Read<unknown>, "data">;
  /** `GET /api/workspace/{pick.id}`. */
  read: Read<W>;
};

/**
 * The one lifecycle of "the workspace this screen is about". Anything not
 * proven is `loading`, so no screen shows a workspace it has not read.
 */
export function deriveActiveWorkspace<W>({
  userKnown,
  pick,
  list,
  read,
}: Input<W>): ActiveWorkspaceState<W> {
  if (pick.kind !== "route" && !userKnown) return { status: "loading" };
  if (pick.kind === "none") {
    if (list.error) return { status: "error", error: list.error };
    return list.isPending ? { status: "loading" } : { status: "none" };
  }
  if (read.error) {
    const kind = classifyWorkspaceReadError(read.error);
    if (kind === "archived") return { status: "archived", pick };
    if (kind === "forbidden") return { status: "unavailable", pick };
    if (read.data === undefined) return { status: "error", error: read.error };
  }
  if (read.data !== undefined) return { status: "ready", workspace: read.data };
  return { status: "loading" };
}
