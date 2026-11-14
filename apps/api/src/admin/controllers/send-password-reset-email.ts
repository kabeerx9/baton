import type { AdminAuditRequest } from "../audit/admin-audit-request";
import { recordAdminAction } from "../audit/record-admin-action";
import { emailPasswordLink } from "../users/account-email-links";
import {
  assertEmailDeliverable,
  deliverOrThrow,
} from "../users/assert-email-deliverable";
import { findAdminTargetUser } from "../users/find-admin-target-user";

/** Email a user a link to choose a new password. The link is never returned. */
async function sendPasswordResetEmail(
  userId: string,
  audit: AdminAuditRequest,
) {
  const user = await findAdminTargetUser(userId);
  assertEmailDeliverable();
  await deliverOrThrow(() => emailPasswordLink(user, "reset"));

  await recordAdminAction({
    ...audit,
    action: "user.password_reset_sent",
    targetType: "user",
    targetId: user.id,
    targetLabel: user.email,
  });
  return { sent: true as const };
}

export default sendPasswordResetEmail;
