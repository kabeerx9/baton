import { eq, sql } from "drizzle-orm";
import { taskChangeRequestTable, type taskTable } from "../database/schema";
import type { DbOrTx } from "../project-access/db-or-tx";
import type { TaskTransaction } from "../task/controllers/with-locked-task";
import type { Channel } from "../utils/request-channel";
import type { CancelReason } from "./cancel-pending";
import type { FinalState } from "./lifecycle";
import {
  canSeeTaskProject,
  isFeature,
  loadPersonGrants,
  projectWorkspaceId,
} from "./load-consent-facts";
import type { ChangeRequestRow } from "./response";
import { personActor } from "./actor";
import { applyTaskChange, type TaskChange } from "./apply-task-change";

type Task = typeof taskTable.$inferSelect;

export type Decider = { userId: string | null; channel: Channel | null };

export async function markRequest(
  database: DbOrTx,
  id: string,
  state: FinalState,
  decider: Decider,
  reason: string | null = null,
) {
  const [row] = await database
    .update(taskChangeRequestTable)
    .set({
      state,
      reason,
      decidedBy: decider.userId,
      decidedChannel: decider.channel,
      decidedAt: sql`(now() AT TIME ZONE 'utc')`,
    })
    .where(eq(taskChangeRequestTable.id, id))
    .returning();
  return row!;
}

/**
 * Why a pending request may no longer apply, or null when it may. Checked
 * under the task lock, before any write: the task is unchanged since the
 * request (status, generation and repo), is still a plain task for a status
 * request, and the requester still holds the permission they asked with.
 */
async function staleReason(
  database: DbOrTx,
  request: ChangeRequestRow,
  task: Task,
): Promise<CancelReason | null> {
  if (
    task.status !== request.baseStatus ||
    task.statusGeneration !== request.baseGeneration ||
    task.projectId !== request.projectId
  )
    return "task_changed";
  if (request.kind === "status" && (await isFeature(database, task.id)))
    return "became_feature";
  if (!request.requestedBy) return "requester_lost_access";
  const workspaceId = await projectWorkspaceId(database, task.projectId);
  if (workspaceId !== request.workspaceId) return "task_changed";
  const grants = await loadPersonGrants(database, workspaceId, {
    userId: request.requestedBy,
    scope: null,
  });
  const visible =
    grants.member &&
    (await canSeeTaskProject(database, request.requestedBy, task.projectId));
  if (!grants.can({ task: ["update"] }) || !visible)
    return "requester_lost_access";
  return null;
}

function isConstraintFailure(error: unknown) {
  const code =
    (error as { code?: unknown; cause?: { code?: unknown } })?.code ??
    (error as { cause?: { code?: unknown } })?.cause?.code;
  return typeof code === "string" && code.startsWith("23");
}

export type Execution =
  | { kind: "applied"; request: ChangeRequestRow; before: Task; after: Task }
  | { kind: "deleted"; request: ChangeRequestRow; before: Task }
  | { kind: "refused"; request: ChangeRequestRow };

class Refusal extends Error {}

/**
 * Applies a pending request the caller has locked (task first, then the
 * request), through the same `applyTaskChange` every status write uses, as
 * the deciding person (accept) or the requester (timeout), so the blocker
 * rule holds. Expected refusals (stale task, lost access, blocked, invalid
 * target) end the request as cancelled with the reason, and the caller
 * commits that. The write runs in a savepoint: a refusal or a database
 * constraint failure rolls back only the savepoint and becomes a
 * cancellation; any other error rolls back the whole transaction and stays
 * retryable.
 */
export async function executeChangeRequest(
  tx: TaskTransaction,
  request: ChangeRequestRow,
  task: Task,
  outcome: "accepted" | "applied_on_timeout",
  decider: Decider,
): Promise<Execution> {
  const refuse = async (reason: string) => ({
    kind: "refused" as const,
    request: await markRequest(tx, request.id, "cancelled", decider, reason),
  });
  const stale = await staleReason(tx, request, task);
  if (stale) return refuse(stale);
  const change: TaskChange | null =
    request.kind === "delete"
      ? { kind: "delete" }
      : request.kind === "status" && request.targetStatus
        ? { kind: "status", status: request.targetStatus }
        : null;
  if (!change) return refuse(`refused: unsupported request`);
  const writer = personActor((decider.userId ?? request.requestedBy)!, {
    channel: decider.channel,
  });

  try {
    return await tx.transaction(async (savepoint): Promise<Execution> => {
      const marked = await markRequest(savepoint, request.id, outcome, decider);
      const applied = await applyTaskChange(savepoint, writer, task, change);
      if (!applied.ok) throw new Refusal(applied.message);
      return applied.kind === "status"
        ? {
            kind: "applied",
            request: marked,
            before: task,
            after: applied.after,
          }
        : { kind: "deleted", request: marked, before: task };
    });
  } catch (error) {
    if (error instanceof Refusal) return refuse(`refused: ${error.message}`);
    if (!isConstraintFailure(error)) throw error;
    return refuse("refused: the change could not be saved");
  }
}
