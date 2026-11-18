import { eq } from "drizzle-orm";
import db, { schema } from "../../database";
import { splitRoles } from "../../utils/split-roles";
import type { WorkspaceActor } from "../../workspace/write/workspace-actor";
import { lockForRoleWrite } from "../authorize-role-write";
import { findLockedRole } from "../find-locked-role";
import { defaultRoleError, roleInUseError } from "../role-errors";
import { isDefaultRoleName } from "../role-rules";

async function deleteWorkspaceRole(input: {
  workspaceId: string;
  roleId: string;
  actor: Extract<WorkspaceActor, { kind: "member" }>;
}) {
  const { workspaceId, roleId, actor } = input;
  return db.transaction(async (tx) => {
    const { locked } = await lockForRoleWrite(tx, workspaceId, actor, {
      ac: ["delete"],
    });
    const role = await findLockedRole(tx, workspaceId, roleId);
    if (isDefaultRoleName(role.role)) throw defaultRoleError();
    if (locked.members.some((row) => splitRoles(row.role).includes(role.role)))
      throw roleInUseError();
    await tx
      .delete(schema.workspaceRoleTable)
      .where(eq(schema.workspaceRoleTable.id, role.id));
    return { id: role.id };
  });
}

export default deleteWorkspaceRole;
