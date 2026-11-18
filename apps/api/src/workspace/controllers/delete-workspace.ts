import { hasInstanceAdminRole } from "../../utils/instance-admin-role";
import type { AdminAuditRequest } from "../../admin/audit/admin-audit-request";
import { deleteWorkspaceData } from "../lifecycle/delete-workspace-data";
import { authorizeWorkspaceWrite } from "../write/authorize-workspace-write";
import type { WorkspaceActor } from "../write/workspace-actor";
import { eq } from "drizzle-orm";
import { schema } from "../../database";

/**
 * A member's delete. Authorization runs inside the delete's transaction,
 * right after the workspace lock. An owner who is also an instance
 * administrator leaves an audit row, as before.
 */
async function deleteWorkspace(input: {
  workspaceId: string;
  actor: Extract<WorkspaceActor, { kind: "member" }>;
  request: Omit<AdminAuditRequest, "actorUserId">;
}) {
  const { workspaceId, actor, request } = input;
  const workspace = await deleteWorkspaceData(workspaceId, {
    allowDemo: true,
    authorize: async (tx, locked) => {
      await authorizeWorkspaceWrite(tx, locked, actor, {
        permissions: { organization: ["delete"] },
      });
      const [user] = await tx
        .select({ role: schema.userTable.role })
        .from(schema.userTable)
        .where(eq(schema.userTable.id, actor.userId))
        .limit(1);
      return hasInstanceAdminRole(user?.role)
        ? { ...request, actorUserId: actor.userId }
        : undefined;
    },
  });
  return { id: workspace.id };
}

export default deleteWorkspace;
