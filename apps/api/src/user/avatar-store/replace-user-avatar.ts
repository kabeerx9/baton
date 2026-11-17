import { createId } from "@paralleldrive/cuid2";
import { eq } from "drizzle-orm";
import { userAvatarTable, userTable } from "../../database/schema";
import { buildAvatarUrl, type DecodedAvatar } from "../avatar";
import { lockAvatarOwner } from "./lock-avatar-owner";
import type { Transaction } from "./transaction";

/** Store a new picture and point `user.image` at it, in the caller's transaction. */
export async function replaceUserAvatar(
  tx: Transaction,
  userId: string,
  { mimeType, bytes }: DecodedAvatar,
) {
  const owner = await lockAvatarOwner(tx, userId);
  const [saved] = await tx
    .insert(userAvatarTable)
    .values({ userId, mimeType, size: bytes.length, data: bytes })
    .onConflictDoUpdate({
      target: userAvatarTable.userId,
      // A new id gives the picture a new URL, so caches never serve the old one.
      set: {
        id: createId(),
        mimeType,
        size: bytes.length,
        data: bytes,
        updatedAt: new Date(),
      },
    })
    .returning({ id: userAvatarTable.id });
  if (!saved) throw new Error("Failed to store avatar");

  const url = buildAvatarUrl(saved.id);
  await tx
    .update(userTable)
    .set({ image: url })
    .where(eq(userTable.id, userId));
  return { owner, avatar: { id: saved.id, url, size: bytes.length } };
}
