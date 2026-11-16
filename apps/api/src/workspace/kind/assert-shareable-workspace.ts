import { APIError } from "better-auth/api";
import { toWorkspaceKind } from "./workspace-kind";

export const DEMO_WORKSPACE_CODE = "DEMO_WORKSPACE";
export const DEMO_WORKSPACE_MESSAGE =
  "A tour workspace belongs to one person. Invite people to a team workspace.";

/**
 * A demo workspace has exactly one member, its owner. Invitations, new
 * members and role changes are refused on the server, not only hidden.
 * Reads the organization record better-auth already loaded (`kind` is one
 * of its fields), so it also works inside better-auth's own transaction.
 */
export function assertShareableOrganization(
  organization: Record<string, unknown>,
) {
  if (toWorkspaceKind(organization.kind) !== "team") {
    throw new APIError("FORBIDDEN", {
      code: DEMO_WORKSPACE_CODE,
      message: DEMO_WORKSPACE_MESSAGE,
    });
  }
}
