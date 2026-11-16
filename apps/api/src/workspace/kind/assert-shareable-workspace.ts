import { APIError } from "better-auth/api";
import { isDemoWorkspace } from "./is-demo-workspace";
import { toWorkspaceKind } from "./workspace-kind";

export const DEMO_WORKSPACE_CODE = "DEMO_WORKSPACE";
export const DEMO_WORKSPACE_MESSAGE =
  "This is a tour workspace. It belongs to one person and connects to nothing outside Baton.";

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

const ROLE_MUTATIONS = new Set([
  "/organization/create-role",
  "/organization/update-role",
  "/organization/delete-role",
]);

/**
 * Role CRUD on a demo workspace is refused: its one member keeps the owner
 * role and the default roles. Better Auth's role endpoints run no member
 * hooks, so the native organization guard checks them by path.
 */
export async function assertRolesEditable(
  ctx: { path?: string; body?: Record<string, unknown> | null },
  viewer: { session: { activeOrganizationId?: unknown } } | null,
) {
  if (!ROLE_MUTATIONS.has(ctx.path ?? "")) return;
  const workspaceId =
    ctx.body?.organizationId ?? viewer?.session.activeOrganizationId;
  if (typeof workspaceId !== "string" || !workspaceId) return;
  if (await isDemoWorkspace(workspaceId)) {
    throw new APIError("FORBIDDEN", {
      code: DEMO_WORKSPACE_CODE,
      message: DEMO_WORKSPACE_MESSAGE,
    });
  }
}
