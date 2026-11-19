import { eq } from "drizzle-orm";
import db, { schema } from "../../database";
import { splitRoles } from "../../utils/split-roles";
import type { WorkspaceActor } from "../../workspace/write/workspace-actor";
import { publishMembersUpdated } from "../../workspace-members/publish-members-updated";
import { assertGrantable, lockForRoleWrite } from "../authorize-role-write";
import { findLockedRole } from "../find-locked-role";
import { defaultRoleError, roleInUseError } from "../role-errors";
import { assertNewRoleName } from "../role-name";
import { toRoleResponse } from "../role-response";
import { isDefaultRoleName, normalizeRoleName } from "../role-rules";

/**
 * Change a role's permissions or name. A built-in role keeps its name, and
 * a role members hold keeps its name too: their member rows name it.
 */
async function updateWorkspaceRole(input: {
  workspaceId: string;
  roleId: string;
  actor: Extract<WorkspaceActor, { kind: "member" }>;
  patch: { role?: string; permission?: Record<string, string[]> };
}) {
  const { workspaceId, roleId, actor, patch } = input;
  const result = await db.transaction(async (tx) => {
    const { locked, member } = await lockForRoleWrite(tx, workspaceId, actor, {
      role: ["update"],
    });
    const role = await findLockedRole(tx, workspaceId, roleId);
    const renamed =
      patch.role !== undefined && normalizeRoleName(patch.role) !== role.role;
    let name = role.role;
    if (renamed) {
      if (isDefaultRoleName(role.role)) throw defaultRoleError();
      if (
        locked.members.some((row) => splitRoles(row.role).includes(role.role))
      )
        throw roleInUseError();
      name = await assertNewRoleName(tx, workspaceId, patch.role!);
    }
    if (patch.permission)
      await assertGrantable(tx, workspaceId, member.role, patch.permission);
    const [row] = await tx
      .update(schema.workspaceRoleTable)
      .set({
        role: name,
        ...(patch.permission
          ? { permission: JSON.stringify(patch.permission) }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(schema.workspaceRoleTable.id, role.id))
      .returning();
    return toRoleResponse(row!);
  });
  // Holders of the role see their capabilities change.
  await publishMembersUpdated(workspaceId);
  return result;
}

export default updateWorkspaceRole;
