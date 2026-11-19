import { count, eq } from "drizzle-orm";
import db, { schema } from "../../database";
import { ApiError } from "../../errors/api-error";
import type { WorkspaceActor } from "../../workspace/write/workspace-actor";
import { assertGrantable, lockForRoleWrite } from "../authorize-role-write";
import { assertNewRoleName } from "../role-name";
import { toRoleResponse } from "../role-response";
import { MAX_ROLES_PER_WORKSPACE } from "../role-rules";

async function createWorkspaceRole(input: {
  workspaceId: string;
  actor: Extract<WorkspaceActor, { kind: "member" }>;
  role: string;
  permission: Record<string, string[]>;
}) {
  const { workspaceId, actor, permission } = input;
  return db.transaction(async (tx) => {
    const { member } = await lockForRoleWrite(tx, workspaceId, actor, {
      role: ["create"],
    });
    const name = await assertNewRoleName(tx, workspaceId, input.role);
    const [existing] = await tx
      .select({ value: count() })
      .from(schema.workspaceRoleTable)
      .where(eq(schema.workspaceRoleTable.workspaceId, workspaceId));
    if ((existing?.value ?? 0) >= MAX_ROLES_PER_WORKSPACE)
      throw new ApiError(400, {
        code: "TOO_MANY_ROLES",
        message: `A workspace has at most ${MAX_ROLES_PER_WORKSPACE} roles.`,
      });
    await assertGrantable(tx, workspaceId, member.role, permission);
    const now = new Date();
    const [row] = await tx
      .insert(schema.workspaceRoleTable)
      .values({
        workspaceId,
        role: name,
        permission: JSON.stringify(permission),
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    return toRoleResponse(row!);
  });
}

export default createWorkspaceRole;
