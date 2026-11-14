import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { userTable } from "../../database/schema";
import { decodeAvatarUpload } from "../../user/avatar";
import saveAvatar from "../../user/controllers/save-avatar";
import type { AdminAuditRequest } from "../audit/admin-audit-request";
import { recordAdminAction } from "../audit/record-admin-action";
import { findAdminTargetUser } from "../users/find-admin-target-user";

/** Upload a new avatar for a user, as they could themselves. */
async function setUserAvatar(
  input: { userId: string; contentType: string; data: string },
  audit: AdminAuditRequest,
) {
  try {
    decodeAvatarUpload(input);
  } catch (error) {
    throw new HTTPException(400, {
      message: error instanceof Error ? error.message : "Invalid avatar upload",
    });
  }

  return db.transaction(async (tx) => {
    const user = await findAdminTargetUser(input.userId, tx);
    const avatar = await saveAvatar(input, tx);
    await tx
      .update(userTable)
      .set({ image: avatar.url })
      .where(eq(userTable.id, user.id));
    await recordAdminAction(
      {
        ...audit,
        action: "user.avatar_changed",
        targetType: "user",
        targetId: user.id,
        targetLabel: user.email,
      },
      tx,
    );
    return { image: avatar.url };
  });
}

export default setUserAvatar;
