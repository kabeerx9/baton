import {
  type BoardTask,
  effectiveStatus,
  isBlocked,
  type Subtask,
} from "../model";
import type { LinkedTask } from "./linked";

/**
 * Whether a task page is done. A board item uses its effective state, so a
 * feature is done only when its tasks are, whatever status is stored on it.
 */
export function pageDone({
  status,
  boardItem,
}: {
  status: string;
  boardItem: BoardTask | Subtask | undefined;
}) {
  return boardItem ? effectiveStatus(boardItem) === "done" : status === "done";
}

/**
 * Whether the task page says "blocked" and disables Done.
 * A board item uses the API's rule. A task that is not on the board (a repo
 * task outside any feature) falls back to its own relations: absence from the
 * board never means unblocked, because the API refuses Done there too.
 */
export function pageBlocked({
  status,
  boardItem,
  waitsOn,
}: {
  status: string;
  boardItem: BoardTask | Subtask | undefined;
  waitsOn: LinkedTask[];
}) {
  if (pageDone({ status, boardItem })) return false;
  if (boardItem) return isBlocked(boardItem);
  return waitsOn.some((t) => t.status !== "done");
}

/** Whether `blocked` is still waiting on `taskId`, for the chain's outgoing cards. */
export function waitingOnThis({
  target,
  taskId,
  fallback,
}: {
  target: { waitsOn: { id: string }[] } | undefined;
  taskId: string;
  /** The relation-only answer, for a target that is not on the board. */
  fallback: boolean;
}) {
  return target ? target.waitsOn.some((b) => b.id === taskId) : fallback;
}

/** What an outgoing chain card says: the dependent is finished, free to go, or still waiting. */
export function dependentState({
  thisDone,
  dependentDone,
  waiting,
}: {
  thisDone: boolean;
  dependentDone: boolean;
  waiting: boolean;
}): "finished" | "canContinue" | "waiting" {
  if (dependentDone) return "finished";
  if (waiting) return "waiting";
  return thisDone ? "canContinue" : "waiting";
}
