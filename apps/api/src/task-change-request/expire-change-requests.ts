import { and, asc, eq, lte, sql } from "drizzle-orm";
import db from "../database";
import { taskChangeRequestTable } from "../database/schema";
import { withJobLease } from "../scheduler/leader-lock";
import { taskRelationsOf } from "../task/controllers/delete-task";
import { lockTask } from "../task/controllers/with-locked-task";
import { dispatchRequestEffects, type RequestEffect } from "./effects";
import {
  type Decider,
  type Execution,
  executeChangeRequest,
  markRequest,
} from "./execute-change-request";
import { isPending } from "./lifecycle";
import { lockWorkspacesShared } from "./lock-workspaces";
import { appliesOnTimeout } from "./request-change";
import { publishExecution } from "./decide-change-request";
import { recordDomainEvent } from "../observability/domain-event";
import { logger } from "../observability/logger";

export const TIMEOUT_BATCH = 100;
const SYSTEM: Decider = { userId: null, channel: null };
const now = sql`(now() AT TIME ZONE 'utc')`;

type Outcome = "applied" | "expired" | "cancelled" | "skipped";

/**
 * Ends one due request in its own transaction. The request's workspace is
 * locked first (FOR SHARE: waits for an archive or delete in progress),
 * then the task (SKIP LOCKED: a busy task waits for the next run), then the
 * request is
 * re-read under lock and its deadline checked by the database clock. Safe
 * when two instances run at once: the second finds it no longer pending.
 */
export async function timeOutRequest(requestId: string): Promise<Outcome> {
  const [due] = await db
    .select({
      taskId: taskChangeRequestTable.taskId,
      kind: taskChangeRequestTable.kind,
      workspaceId: taskChangeRequestTable.workspaceId,
    })
    .from(taskChangeRequestTable)
    .where(eq(taskChangeRequestTable.id, requestId))
    .limit(1);
  if (!due) return "skipped";
  const relations =
    due.kind === "delete" && due.taskId
      ? await taskRelationsOf(due.taskId)
      : [];
  const effects: RequestEffect[] = [];
  const done: { execution: Execution | null } = { execution: null };

  const outcome = await db.transaction(async (tx): Promise<Outcome> => {
    const workspaces = await lockWorkspacesShared(tx, [due.workspaceId]);
    // A deleted workspace took the request with it.
    if (!workspaces.has(due.workspaceId)) return "skipped";
    const task = due.taskId
      ? await lockTask(tx, due.taskId, { skipLocked: true })
      : undefined;
    if (due.taskId && !task) return "skipped";
    const [request] = await tx
      .select()
      .from(taskChangeRequestTable)
      .where(
        and(
          eq(taskChangeRequestTable.id, requestId),
          lte(taskChangeRequestTable.expiresAt, now),
        ),
      )
      .for("update");
    if (!request || !isPending(request.state)) return "skipped";

    const applies =
      task &&
      (await appliesOnTimeout(
        tx,
        task.projectId,
        request.kind,
        request.baseStatus,
        request.targetStatus,
      ));
    if (!task || !applies) {
      const expired = await markRequest(tx, request.id, "expired", SYSTEM);
      effects.push({ type: "finished", request: expired, actorId: null });
      return "expired";
    }
    const execution = await executeChangeRequest(
      tx,
      request,
      task,
      "applied_on_timeout",
      SYSTEM,
    );
    done.execution = execution;
    effects.push({
      type: "finished",
      request: execution.request,
      actorId: null,
    });
    return execution.kind === "refused" ? "cancelled" : "applied";
  });

  if (done.execution)
    // The request's own author caused the change, so the audit names them.
    await publishExecution(
      done.execution,
      done.execution.request.requestedBy,
      relations,
    );
  await dispatchRequestEffects(effects);
  return outcome;
}

/** Due request ids, read without locks. */
async function dueRequestIds(limit: number) {
  const rows = await db
    .select({ id: taskChangeRequestTable.id })
    .from(taskChangeRequestTable)
    .where(
      and(
        eq(taskChangeRequestTable.state, "pending"),
        lte(taskChangeRequestTable.expiresAt, now),
      ),
    )
    .orderBy(asc(taskChangeRequestTable.expiresAt))
    .limit(limit);
  return rows.map((row) => row.id);
}

export async function runChangeRequestTimeouts(limit = TIMEOUT_BATCH) {
  const counts: Record<Outcome, number> = {
    applied: 0,
    expired: 0,
    cancelled: 0,
    skipped: 0,
  };
  let degraded = false;
  for (const id of await dueRequestIds(limit)) {
    try {
      const outcome = await timeOutRequest(id);
      counts[outcome]++;
      recordDomainEvent("change_request", "Change request timed out", {
        change_request_id: id,
        outcome,
      });
    } catch (error) {
      degraded = true;
      logger.error("[change-request] timeout failed", {
        change_request_id: id,
        error,
      });
    }
  }
  return { ...counts, degraded };
}

/**
 * The hourly job. The lease only saves duplicate work across instances;
 * correctness comes from the per-request transaction above.
 */
export function expireChangeRequests() {
  return withJobLease(
    "task-change-request-timeouts",
    runChangeRequestTimeouts,
    () => ({
      applied: 0,
      expired: 0,
      cancelled: 0,
      skipped: 0,
      degraded: false,
    }),
  );
}
