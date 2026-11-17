import db from "../../database";
import { parseAvatarUpload } from "../../user/avatar-store/parse-avatar-upload";
import { replaceUserAvatar } from "../../user/avatar-store/replace-user-avatar";
import type { AdminAuditRequest } from "../audit/admin-audit-request";
import { recordAdminAction } from "../audit/record-admin-action";

/** Upload a new avatar for a user, as they could themselves. */
async function setUserAvatar(
  input: { userId: string; contentType: string; data: string },
  audit: AdminAuditRequest,
) {
  const decoded = parseAvatarUpload(input);

  return db.transaction(async (tx) => {
    const { owner, avatar } = await replaceUserAvatar(
      tx,
      input.userId,
      decoded,
    );
    await recordAdminAction(
      {
        ...audit,
        action: "user.avatar_changed",
        targetType: "user",
        targetId: owner.id,
        targetLabel: owner.email,
      },
      tx,
    );
    return { image: avatar.url };
  });
}

export default setUserAvatar;
