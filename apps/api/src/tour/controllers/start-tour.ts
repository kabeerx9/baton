import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  afterDemoDeleted,
  deleteDemoWorkspace,
  lockDemoWorkspace,
} from "../demo/delete-demo-workspace";
import { readDemoWorkspace } from "../demo/read-demo-workspace";
import { seedDemoWorkspace } from "../demo/seed-demo-workspace";
import { decideTour } from "../lifecycle";
import { lockTourUser } from "../lock-tour-user";

/**
 * Idempotent while the tour runs: a reload or a second tab gets the same
 * demo back. Seeds one when none exists, and replaces a demo that lost a
 * tour task, since the tour cannot continue in it.
 */
async function startTour(userId: string) {
  const { demo, deleted } = await db.transaction(async (tx) => {
    const tourState = await lockTourUser(tx, userId);
    const existing =
      tourState.kind === "pending" ? await lockDemoWorkspace(tx, userId) : null;
    const current = existing ? await readDemoWorkspace(tx, existing) : null;
    const action = decideTour(
      tourState,
      "start",
      !existing ? "none" : current ? "intact" : "broken",
    );
    switch (action.kind) {
      case "refuse_completed":
        throw new HTTPException(409, {
          message: "The tour is already completed. Replay it before starting.",
        });
      case "resume_demo":
        return { demo: current!, deleted: null };
      case "reset_demo": {
        const deleted = await deleteDemoWorkspace(tx, existing!, userId);
        return { demo: await seedDemoWorkspace(tx, userId), deleted };
      }
      case "seed_demo":
        return { demo: await seedDemoWorkspace(tx, userId), deleted: null };
      default:
        throw new HTTPException(500, { message: "Unexpected tour action" });
    }
  });
  await afterDemoDeleted(deleted);
  return demo;
}

export default startTour;
