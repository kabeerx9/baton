import { eq } from "drizzle-orm";
import db from "../../database";
import { userTable } from "../../database/schema";
import { decideTour } from "../lifecycle";
import { lockTourUser } from "../lock-tour-user";

/** Clears completion only; the client calls start next. */
async function replayTour(userId: string) {
  await db.transaction(async (tx) => {
    const action = decideTour(await lockTourUser(tx, userId), "replay");
    if (action.kind === "reopen") {
      await tx
        .update(userTable)
        .set({ tourCompletedAt: null })
        .where(eq(userTable.id, userId));
    }
  });
  return { completed: false as const };
}

export default replayTour;
