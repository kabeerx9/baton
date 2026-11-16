import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { userTable } from "../database/schema";
import type { OutboxTransaction } from "../events/outbox/consumer";
import { type TourState, toTourState } from "./lifecycle";

/**
 * The first statement of every tour transaction. It serializes one user's
 * tour commands, so two parallel starts run one after the other and leave
 * one demo workspace. NO KEY UPDATE does not block other transactions that
 * insert rows referencing the user. Lock order: user, then the workspace.
 */
export async function lockTourUser(
  tx: OutboxTransaction,
  userId: string,
): Promise<TourState> {
  const [user] = await tx
    .select({ tourCompletedAt: userTable.tourCompletedAt })
    .from(userTable)
    .where(eq(userTable.id, userId))
    .for("no key update");
  if (!user) throw new HTTPException(404, { message: "User not found" });
  return toTourState(user.tourCompletedAt);
}
