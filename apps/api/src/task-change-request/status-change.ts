import { and, eq } from "drizzle-orm";
import { columnTable, taskTable } from "../database/schema";
import type { DbOrTx } from "../project-access/db-or-tx";
import { findBlockedMessage } from "../task/assert-not-blocked";
import { getValidTaskStatuses } from "../task/validate-task-fields";

export type StatusCheck =
  | { ok: true; columnId: string | null; isFinal: boolean }
  | { ok: false; status: 400 | 409; message: string };

/**
 * Every precondition of a status write, without writing: the status exists
 * in the task's repo, and a move into a final column is not blocked. Shared by
 * every person path, accept and the timeout, so they cannot drift apart.
 */
export async function checkStatusChange(
  database: DbOrTx,
  task: { id: string; projectId: string; status: string },
  status: string,
  viewerId: string | null,
): Promise<StatusCheck> {
  const valid = await getValidTaskStatuses(task.projectId, database);
  if (!valid.includes(status))
    return {
      ok: false,
      status: 400,
      message: `Invalid status "${status}". Valid statuses for this project: ${valid.join(", ")}`,
    };
  const [column] = await database
    .select({ id: columnTable.id, isFinal: columnTable.isFinal })
    .from(columnTable)
    .where(
      and(
        eq(columnTable.projectId, task.projectId),
        eq(columnTable.slug, status),
      ),
    )
    .limit(1);
  const isFinal = column?.isFinal ?? false;
  if (isFinal && status !== task.status) {
    const blocked = await findBlockedMessage(database, task.id, viewerId);
    if (blocked) return { ok: false, status: 409, message: blocked };
  }
  return { ok: true, columnId: column?.id ?? null, isFinal };
}

/** The current final-column flag for a status in a repo; null when unknown. */
export async function columnFinality(
  database: DbOrTx,
  projectId: string,
  status: string,
): Promise<boolean | null> {
  const [column] = await database
    .select({ isFinal: columnTable.isFinal })
    .from(columnTable)
    .where(
      and(eq(columnTable.projectId, projectId), eq(columnTable.slug, status)),
    )
    .limit(1);
  return column ? column.isFinal : null;
}

export async function writeStatus(
  database: DbOrTx,
  taskId: string,
  status: string,
  columnId: string | null,
) {
  const [after] = await database
    .update(taskTable)
    .set({ status, columnId })
    .where(eq(taskTable.id, taskId))
    .returning();
  return after;
}
