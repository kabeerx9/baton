import type { CloseVerdict } from "./connection-state";

export type ProjectEndReason =
  | "workspace-archived"
  | "workspace-access-revoked"
  | "project-access-revoked";

/** Other 1008 reasons, such as "Project workspace changed", retry. */
export function classifyProjectClose(
  code: number | undefined,
  reason: string | undefined,
): CloseVerdict<ProjectEndReason> {
  if (code === 4001) return "check-session";
  if (code !== 1008) return "retry";
  switch (reason) {
    case "Workspace archived":
      return { end: "workspace-archived" };
    case "Workspace access revoked":
      return { end: "workspace-access-revoked" };
    case "Project access revoked":
      return { end: "project-access-revoked" };
    default:
      return "retry";
  }
}
