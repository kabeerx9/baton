import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../database";
import { taskTable } from "../database/schema";
import type { DbOrTx } from "../project-access/db-or-tx";
import type { TaskTransaction } from "../task/controllers/with-locked-task";
import type { TaskActor } from "./actor";
import { decideConsent } from "./consent";
import { type ConsentTask, loadConsentFacts } from "./load-consent-facts";
import { consentError } from "./request-change";

type EditOptions = {
  /**
   * Judge the caller as if they held task:update_assigned only. For paths
   * whose usual permission is not task:update (labels need label:update), so
   * task:update never stands in for it.
   */
  assignedOnly?: boolean;
};

/**
 * Refuses a field edit (title, description, priority, dates, labels,
 * comments, uploads) the caller may not make on this task. Call it on the
 * locked row where the path holds one: task:update_assigned works only on a
 * task assigned to the caller. System writers skip it.
 */
export async function assertMayEdit(
  database: DbOrTx,
  task: ConsentTask,
  actor: TaskActor,
  options: EditOptions = {},
) {
  if (actor.kind !== "person") return;
  const facts = await loadConsentFacts(database, task, actor);
  const consent = decideConsent(
    "edit",
    options.assignedOnly ? { ...facts, canUpdate: false } : facts,
  );
  if (consent.kind === "deny") throw consentError(consent);
}

/**
 * Holds the task row FOR SHARE in `tx` and runs `assertMayEdit` on it, so a
 * reassignment cannot slip in between the check and the caller's write.
 */
export async function lockEditableTask(
  tx: DbOrTx,
  taskId: string,
  actor: TaskActor,
  options: EditOptions = {},
) {
  const [task] = await tx
    .select({
      id: taskTable.id,
      projectId: taskTable.projectId,
      createdBy: taskTable.createdBy,
      userId: taskTable.userId,
    })
    .from(taskTable)
    .where(eq(taskTable.id, taskId))
    .for("share");
  if (!task) throw new HTTPException(404, { message: "Task not found" });
  await assertMayEdit(tx, task, actor, options);
  return task;
}

/** `write` in a transaction that holds an editable task (comments). */
export async function withEditableTask<T>(
  taskId: string,
  actor: TaskActor,
  write: (tx: TaskTransaction) => Promise<T>,
) {
  return db.transaction(async (tx) => {
    await lockEditableTask(tx, taskId, actor);
    return write(tx);
  });
}
