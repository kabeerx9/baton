import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  afterDemoDeleted,
  deleteDemoWorkspace,
  lockDemoWorkspace,
} from "../demo/delete-demo-workspace";
import { seedDemoWorkspace } from "../demo/seed-demo-workspace";
import { decideTour } from "../lifecycle";
import { lockTourUser } from "../lock-tour-user";

/** Start and restart are one reset: delete the demo, seed a fresh one. */
async function startTour(userId: string) {
  const { seeded, deleted } = await db.transaction(async (tx) => {
    const action = decideTour(await lockTourUser(tx, userId), "start");
    if (action.kind === "refuse_completed") {
      throw new HTTPException(409, {
        message: "The tour is already completed. Replay it before starting.",
      });
    }
    const existing = await lockDemoWorkspace(tx, userId);
    const deleted = existing
      ? await deleteDemoWorkspace(tx, existing, userId)
      : null;
    return { seeded: await seedDemoWorkspace(tx, userId), deleted };
  });
  await afterDemoDeleted(deleted);
  return seeded;
}

export default startTour;
