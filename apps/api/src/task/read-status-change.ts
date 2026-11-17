import { eq } from "drizzle-orm";
import db from "../database";
import { taskTable } from "../database/schema";
import type { PersonActor } from "../task-change-request/actor";
import { loadStatusMove } from "../task-change-request/status-capability";

/**
 * `statusChange` for one task read on its own: the same consent facts the
 * status write loads, without the lock. The creator stays server-side.
 */
export async function readStatusChange(
  taskId: string,
  person: Pick<PersonActor, "userId" | "scope">,
) {
  const [task] = await db
    .select({
      id: taskTable.id,
      projectId: taskTable.projectId,
      createdBy: taskTable.createdBy,
      userId: taskTable.userId,
      status: taskTable.status,
    })
    .from(taskTable)
    .where(eq(taskTable.id, taskId))
    .limit(1);
  // A task gone since the read was loaded: the safe answer.
  if (!task) return { move: "request" as const };
  return { move: await loadStatusMove(db, task, person) };
}
