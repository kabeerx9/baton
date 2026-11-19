import { workspaceUserTable } from "../database/schema";
import {
  rolesAllow,
  type StoredRolePermission,
} from "../utils/role-permissions";
import { splitRoles } from "../utils/split-roles";

export const workspaceAccessColumns = {
  role: workspaceUserTable.role,
};

export type WorkspaceAccess = {
  role: string | null;
};

/**
 * A member reads their workspace: every role they hold grants
 * workspace:read (`withWorkspaceRead`). A non-member reads nothing, and an
 * instance administrator is an ordinary user here; they use /api/admin.
 */
export function canReadWorkspace(
  access: WorkspaceAccess,
  storedRoles: readonly StoredRolePermission[],
) {
  return rolesAllow(splitRoles(access.role), storedRoles, {
    workspace: ["read"],
  });
}
