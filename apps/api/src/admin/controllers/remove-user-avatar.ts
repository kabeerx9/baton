import { eq } from "drizzle-orm";
import db from "../../database";
import { userAvatarTable, userTable } from "../../database/schema";
import type { AdminAuditRequest } from "../audit/admin-audit-request";
import { recordAdminAction } from "../audit/record-admin-action";
import { findAdminTargetUser } from "../users/find-admin-target-user";

/** Remove a user's picture. */
async function removeUserAvatar(userId: string, audit: AdminAuditRequest) {
  return db.transaction(async (tx) => {
    const user = await findAdminTargetUser(userId, tx);
    const deleted = await tx
      .delete(userAvatarTable)
      .where(eq(userAvatarTable.userId, user.id))
      .returning({ id: userAvatarTable.id });
    if (user.image === null && deleted.length === 0) return { removed: false };

    await tx
      .update(userTable)
      .set({ image: null })
      .where(eq(userTable.id, user.id));
    await recordAdminAction(
      {
        ...audit,
        action: "user.avatar_removed",
        targetType: "user",
        targetId: user.id,
        targetLabel: user.email,
      },
      tx,
    );
    return { removed: true };
  });
}

export default removeUserAvatar;
