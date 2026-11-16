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
 * Finishing and skipping end the tour the same way. Idempotent: a second
 * call keeps the first completion time and only removes a leftover demo.
 */
async function finishTour(userId: string) {
  const deleted = await db.transaction(async (tx) => {
    const action = decideTour(await lockTourUser(tx, userId), "finish");
    if (action.kind === "complete") {
      await tx
        .update(userTable)
        .set({ tourCompletedAt: new Date() })
        .where(eq(userTable.id, userId));
    }
    const demo = await lockDemoWorkspace(tx, userId);
    return demo ? deleteDemoWorkspace(tx, demo, userId) : null;
  });
  await afterDemoDeleted(deleted);
  return { completed: true as const };
}

export default finishTour;
