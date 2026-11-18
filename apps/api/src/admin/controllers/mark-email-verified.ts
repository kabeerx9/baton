import db from "../../database";
import { identity } from "../../identity";
import type { AdminAuditRequest } from "../audit/admin-audit-request";
import { recordAdminAction } from "../audit/record-admin-action";
import { lockAdminTargetUser } from "../users/lock-admin-target-user";

/** Mark a user's email verified. Already verified addresses are left alone. */
async function markEmailVerified(userId: string, audit: AdminAuditRequest) {
  await db.transaction(async (tx) => {
    // Locked, so two requests cannot both see "unverified" and both audit.
    const target = await lockAdminTargetUser(userId, tx);
    if (target.emailVerified) return;
    await identity.users.update(tx, userId, { emailVerified: true });

    await recordAdminAction(
      {
        ...audit,
        action: "user.email_verified",
        targetType: "user",
        targetId: userId,
        targetLabel: target.email,
      },
      tx,
    );
  });
  return { emailVerified: true as const };
}

export default markEmailVerified;
