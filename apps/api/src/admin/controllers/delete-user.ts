import { eq } from "drizzle-orm";
import db from "../../database";
import { userTable } from "../../database/schema";
import { ApiError } from "../../errors/api-error";
import { identity } from "../../identity";
import deleteAccountData from "../../user/controllers/delete-account-data";
import { hasOtherInstanceAdmin } from "../../utils/has-other-instance-admin";
import { hasInstanceAdminRole } from "../../utils/instance-admin-role";
import { revokeUserConnections } from "../../ws";
import type { AdminAuditRequest } from "../audit/admin-audit-request";
import { recordAdminAction } from "../audit/record-admin-action";
import { rejectSelfAction } from "../users/reject-self-action";

/** Delete a user's account, workspaces they solely own, and their sessions. */
async function deleteUser(
  userId: string,
  actorId: string,
  audit: AdminAuditRequest,
) {
  rejectSelfAction(
    actorId,
    userId,
    "YOU_CANNOT_REMOVE_YOURSELF",
    "You cannot remove yourself.",
  );
  await db.transaction(async (tx) => {
    // The advisory lock serializes role removals before account cleanup.
    const otherAdminRemains = await hasOtherInstanceAdmin(tx);
    const [target] = await tx
      .select({
        name: userTable.name,
        email: userTable.email,
        role: userTable.role,
      })
      .from(userTable)
      .where(eq(userTable.id, userId))
      .limit(1);
    if (!target) {
      throw new ApiError(404, { code: "NOT_FOUND", message: "User not found" });
    }
    if (hasInstanceAdminRole(target.role) && !otherAdminRemains) {
      throw new ApiError(400, {
        code: "CANNOT_REMOVE_LAST_ADMIN",
        message: "The instance must have at least one administrator.",
      });
    }
    // The same cleanup as self-service account deletion, with its conflicts.
    await deleteAccountData(userId, tx);
    // deleteAccountData locked the user (NO KEY UPDATE), then workspaces.
    // Sessions take the full user lock last, after the workspace deletes.
    await identity.fence.endSessions(tx, userId, { allExcept: null });
    await identity.fence.removeUser(tx, userId);
    await recordAdminAction(
      {
        ...audit,
        action: "user.deleted",
        targetType: "user",
        targetId: userId,
        targetLabel: target.email,
        metadata: { name: target.name },
      },
      tx,
    );
  });
  await revokeUserConnections(userId);
  return { id: userId };
}

export default deleteUser;
