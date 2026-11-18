import { ApiError } from "../errors/api-error";
import type { DbOrTx } from "../project-access/db-or-tx";
import { roleHasWorkspacePermission } from "../utils/require-workspace-permission";
import type { PermissionMap } from "../utils/role-permissions";
import { lockWorkspace } from "../workspace/lifecycle/lock-workspace";
import { authorizeWorkspaceWrite } from "../workspace/write/authorize-workspace-write";
import type { WorkspaceActor } from "../workspace/write/workspace-actor";
import { eachPermission, unknownPermissions } from "./role-rules";

type MemberActor = Extract<WorkspaceActor, { kind: "member" }>;

/** Lock the workspace and decide a role write under the lock. */
export async function lockForRoleWrite(
  tx: DbOrTx,
  workspaceId: string,
  actor: MemberActor,
  permissions: PermissionMap,
) {
  const locked = await lockWorkspace(tx, workspaceId, { allowDemo: true });
  const member = await authorizeWorkspaceWrite(tx, locked, actor, {
    permissions,
    refuseDemo: true,
  });
  return { locked, member: member! };
}

/**
 * A role may grant only known permissions, and only ones the actor holds:
 * nobody hands out more than they have (the provider's rule).
 */
export async function assertGrantable(
  tx: DbOrTx,
  workspaceId: string,
  actorRole: string,
  permission: PermissionMap,
) {
  const unknown = unknownPermissions(permission);
  if (unknown.length > 0)
    throw new ApiError(400, {
      code: "UNKNOWN_PERMISSION",
      message: `Unknown permissions: ${unknown.join(", ")}`,
    });
  const missing: string[] = [];
  for (const single of eachPermission(permission)) {
    if (!(await roleHasWorkspacePermission(workspaceId, actorRole, single, tx)))
      missing.push(Object.entries(single).map(([r, [a]]) => `${r}:${a}`)[0]!);
  }
  if (missing.length > 0)
    throw new ApiError(403, {
      code: "ROLE_EXCEEDS_YOUR_PERMISSIONS",
      message: "You can't give a role permissions you don't have.",
      missingPermissions: missing,
    });
}
