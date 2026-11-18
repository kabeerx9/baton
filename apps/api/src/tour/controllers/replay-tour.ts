import { eq } from "drizzle-orm";
import db from "../../database";
import { userTable } from "../../database/schema";
import {
  afterDemoDeleted,
  deleteDemoWorkspace,
  lockDemoWorkspace,
} from "../demo/delete-demo-workspace";
import { decideTour } from "../lifecycle";
import { lockTourUser } from "../lock-tour-user";

/**
 * Clears completion; the client calls start next. A leftover demo goes too,
 * because start now resumes an existing demo and a replay starts fresh.
 */
async function replayTour(userId: string) {
  const deleted = await db.transaction(async (tx) => {
    const action = decideTour(await lockTourUser(tx, userId), "replay");
    if (action.kind !== "reopen") return null;
    await tx
      .update(userTable)
      .set({ tourCompletedAt: null })
      .where(eq(userTable.id, userId));
    const demo = await lockDemoWorkspace(tx, userId);
    return demo ? deleteDemoWorkspace(tx, demo, userId) : null;
  });
  await afterDemoDeleted(deleted);
  return { completed: false as const };
}

export default replayTour;
