import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { projectTable, taskTable } from "../../database/schema";
import { lockRequestQuota } from "../../task-change-request/request-quota";
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

/**
 * For paths that may open a change request. Lock order: the task's project
 * (KEY SHARE: waits while a reorder or project delete holds it FOR UPDATE),
 * then the requester's quota, then the task. The request INSERT's foreign
 * key to the project then never waits while the task is held.
 */
export async function withLockedProjectTask<T>(
  id: string,
  requesterId: string | null,
  mutate: (
    tx: TaskTransaction,
    before: typeof taskTable.$inferSelect,
  ) => Promise<T>,
) {
  return db.transaction(async (tx) => {
    const [peek] = await tx
      .select({ projectId: taskTable.projectId })
      .from(taskTable)
      .where(eq(taskTable.id, id));
    if (!peek) throw new HTTPException(404, { message: "Task not found" });
    const [project] = await tx
      .select({ id: projectTable.id, workspaceId: projectTable.workspaceId })
      .from(projectTable)
      .where(eq(projectTable.id, peek.projectId))
      .for("key share");
    if (!project)
      throw new HTTPException(409, {
        message: "Task changed projects; retry the operation",
      });
    if (requesterId)
      await lockRequestQuota(tx, project.workspaceId, requesterId);
    const before = await lockTask(tx, id);
    if (!before) throw new HTTPException(404, { message: "Task not found" });
    if (before.projectId !== project.id)
      throw new HTTPException(409, {
        message: "Task changed projects; retry the operation",
      });
    return { before, after: await mutate(tx, before) };
  });
}
