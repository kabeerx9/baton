import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { taskTable } from "../../database/schema";
import type { DbOrTx } from "../../project-access/db-or-tx";

export type TaskTransaction = Parameters<
  Parameters<typeof db.transaction>[0]
>[0];

/**
 * Locks one task row in the caller's transaction. Lock order across the
 * codebase: projects (when moving), then tasks by id, then change requests.
 * With `skipLocked`, a row another transaction holds returns undefined.
 */
export async function lockTask(
  tx: DbOrTx,
  id: string,
  options: { skipLocked?: boolean } = {},
) {
  const query = tx.select().from(taskTable).where(eq(taskTable.id, id));
  const [row] = await (options.skipLocked
    ? query.for("update", { skipLocked: true })
    : query.for("update"));
  return row;
}

export async function withLockedTask<T>(
  id: string,
  mutate: (
    tx: TaskTransaction,
    before: typeof taskTable.$inferSelect,
  ) => Promise<T>,
) {
  return db.transaction(async (tx) => {
    const before = await lockTask(tx, id);
    if (!before) throw new HTTPException(404, { message: "Task not found" });
    return { before, after: await mutate(tx, before) };
  });
}
