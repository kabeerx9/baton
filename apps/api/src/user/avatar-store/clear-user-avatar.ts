import { eq } from "drizzle-orm";
import { userAvatarTable, userTable } from "../../database/schema";
import { lockAvatarOwner } from "./lock-avatar-owner";
import type { Transaction } from "./transaction";

/** Delete the stored picture and clear `user.image`, in the caller's transaction. */
export async function clearUserAvatar(tx: Transaction, userId: string) {
  const owner = await lockAvatarOwner(tx, userId);
  const deleted = await tx
    .delete(userAvatarTable)
    .where(eq(userAvatarTable.userId, userId))
    .returning({ id: userAvatarTable.id });
  if (owner.image !== null) {
    await tx
      .update(userTable)
      .set({ image: null })
      .where(eq(userTable.id, userId));
  }
  return { owner, deleted: deleted.length > 0 };
}
