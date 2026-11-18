import { isWorkspaceArchivedError } from "@/lib/is-workspace-archived-error";

export type WorkspaceEntry =
  | { status: "ready" }
  | { status: "not-member" }
  | { status: "failed"; error: unknown };

type SetActiveResult = { error?: { status?: number; code?: string } | null };

type Input = {
  workspaceId: string;
  /** The session's active workspace; undefined when none or unknown. */
  sessionActiveId: string | undefined;
  setActive: (workspaceId: string) => Promise<SetActiveResult | null>;
};

const NOT_MEMBER_CODES = new Set([
  "USER_IS_NOT_A_MEMBER_OF_THE_ORGANIZATION",
  "ORGANIZATION_NOT_FOUND",
]);

/**
 * The URL names the workspace; the session must agree before anything under
 * it renders, because settings and destructive actions read the session.
 * Archived workspaces keep their own screen, so they count as ready.
 */
export async function enterWorkspace({
  workspaceId,
  sessionActiveId,
  setActive,
}: Input): Promise<WorkspaceEntry> {
  if (sessionActiveId === workspaceId) return { status: "ready" };
  let result: SetActiveResult | null;
  try {
    result = await setActive(workspaceId);
  } catch (error) {
    return { status: "failed", error };
  }
  const error = result?.error;
  if (!error) return { status: "ready" };
  if (isWorkspaceArchivedError(error)) return { status: "ready" };
  if (
    error.status === 403 ||
    error.status === 404 ||
    (error.code && NOT_MEMBER_CODES.has(error.code))
  )
    return { status: "not-member" };
  return { status: "failed", error };
}
