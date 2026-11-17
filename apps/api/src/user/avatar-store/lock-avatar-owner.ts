import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { userTable } from "../../database/schema";
import type { Transaction } from "./transaction";

/**
 * Every avatar write locks the `user` row first, then touches `user_avatar`.
 * One lock order per user keeps the row and `user.image` in step and avoids
 * deadlocks between self and admin paths.
 */
export async function lockAvatarOwner(tx: Transaction, userId: string) {
  const [owner] = await tx
    .select({
      id: userTable.id,
      email: userTable.email,
      image: userTable.image,
    })
    .from(userTable)
    .where(eq(userTable.id, userId))
    .for("update");
  if (!owner) throw new HTTPException(404, { message: "User not found" });
  return owner;
}

export type AvatarOwner = Awaited<ReturnType<typeof lockAvatarOwner>>;
