import { isWorkspaceArchivedError } from "@/lib/is-workspace-archived-error";

export type WorkspaceReadError = "archived" | "forbidden" | "failed";

/**
 * What a failed `GET /api/workspace/{id}` means. Archived is a 403 with its
 * own code, so it is tested before the plain 403/404.
 */
export function classifyWorkspaceReadError(error: unknown): WorkspaceReadError {
  if (isWorkspaceArchivedError(error)) return "archived";
  const status =
    typeof error === "object" && error !== null && "status" in error
      ? error.status
      : undefined;
  if (status === 403 || status === 404) return "forbidden";
  return "failed";
}

/** Archived, not a member, or gone: retrying will not change the answer. */
export function isWorkspaceUnavailable(error: unknown) {
  return classifyWorkspaceReadError(error) !== "failed";
}
