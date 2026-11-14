import { and, count, eq, gt, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { projectTable, taskChangeRequestTable } from "../database/schema";
import type { DbOrTx } from "../project-access/db-or-tx";
import { taskKey } from "../task/linked-task";
import type { PersonActor } from "./actor";
import type { ChangeRequestRow } from "./response";

export const REQUESTS_PER_HOUR = 10;

export type LockedTask = {
  id: string;
  projectId: string;
  title: string;
  number: number | null;
  status: string;
  statusGeneration: number;
};

export type OpenedRequest = {
  request: ChangeRequestRow;
  /** The request this one replaced, if another person had one open. */
  superseded: ChangeRequestRow | null;
  /** True when the same request was already open: nothing changed. */
  replay: boolean;
};

/**
 * Opens a change request on a task the caller has locked. The same person
 * asking for the same thing again gets the open request back (safe to retry).
 * Anyone else's open request is superseded. The partial unique index on
 * pending rows is the final guard if two callers race past the lock.
 */
export async function openChangeRequest(
  database: DbOrTx,
  {
    task,
    workspaceId,
    actor,
    kind,
    targetStatus,
  }: {
    task: LockedTask;
    workspaceId: string;
    actor: PersonActor;
    kind: "status" | "delete";
    targetStatus: string | null;
  },
): Promise<OpenedRequest> {
  const [open] = await database
    .select()
    .from(taskChangeRequestTable)
    .where(
      and(
        eq(taskChangeRequestTable.taskId, task.id),
        eq(taskChangeRequestTable.state, "pending"),
      ),
    )
    .for("update");
  if (
    open &&
    open.requestedBy === actor.userId &&
    open.kind === kind &&
    open.targetStatus === targetStatus
  )
    return { request: open, superseded: null, replay: true };

  const [recent] = await database
    .select({ total: count() })
    .from(taskChangeRequestTable)
    .where(
      and(
        eq(taskChangeRequestTable.requestedBy, actor.userId),
        eq(taskChangeRequestTable.workspaceId, workspaceId),
        gt(
          taskChangeRequestTable.createdAt,
          sql`(now() AT TIME ZONE 'utc') - interval '1 hour'`,
        ),
      ),
    );
  if ((recent?.total ?? 0) >= REQUESTS_PER_HOUR)
    throw new HTTPException(429, {
      message: `You can make at most ${REQUESTS_PER_HOUR} change requests per hour in a workspace. Try again later.`,
    });

  let superseded: ChangeRequestRow | undefined;
  if (open) {
    [superseded] = await database
      .update(taskChangeRequestTable)
      .set({
        state: "superseded",
        reason: "superseded",
        decidedAt: sql`(now() AT TIME ZONE 'utc')`,
      })
      .where(eq(taskChangeRequestTable.id, open.id))
      .returning();
  }

  const [project] = await database
    .select({ slug: projectTable.slug })
    .from(projectTable)
    .where(eq(projectTable.id, task.projectId))
    .limit(1);
  const [request] = await database
    .insert(taskChangeRequestTable)
    .values({
      taskId: task.id,
      workspaceId,
      projectId: task.projectId,
      taskKey: taskKey(project?.slug ?? "T", task.number),
      taskTitle: task.title,
      requestedBy: actor.userId,
      channel: actor.channel,
      kind,
      targetStatus,
      baseStatus: task.status,
      baseGeneration: task.statusGeneration,
      expiresAt: sql`(now() AT TIME ZONE 'utc') + interval '24 hours'`,
    })
    .returning();
  if (!request)
    throw new HTTPException(500, { message: "Failed to record the request" });
  return { request, superseded: superseded ?? null, replay: false };
}
