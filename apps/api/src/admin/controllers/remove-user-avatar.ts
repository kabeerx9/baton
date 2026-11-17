import db from "../../database";
import { clearUserAvatar } from "../../user/avatar-store/clear-user-avatar";
import type { AdminAuditRequest } from "../audit/admin-audit-request";
import { recordAdminAction } from "../audit/record-admin-action";

/** Remove a user's picture. */
async function removeUserAvatar(userId: string, audit: AdminAuditRequest) {
  return db.transaction(async (tx) => {
    const { owner, deleted } = await clearUserAvatar(tx, userId);
    if (owner.image === null && !deleted) return { removed: false };

    await recordAdminAction(
      {
        ...audit,
        action: "user.avatar_removed",
        targetType: "user",
        targetId: owner.id,
        targetLabel: owner.email,
      },
      tx,
    );
    return { removed: true };
  });
}

export default removeUserAvatar;
