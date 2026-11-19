import {
  type Blocker,
  type BoardTask,
  isBlocked,
  type Person,
  type Status,
  type Subtask,
} from "@/components/board/model";
import type { LinkedTask } from "@/components/board/task-flow/linked";
import type { PendingRequest } from "@/components/task/change-request/describe-pending";

/**
 * Where a feature stands. A feature has no status of its own (BOARD.md rule 3),
 * so this is derived from its tasks, in one place, in this order. Every variant
 * renders from it; none of them recomputes it.
 */
export type FeatureStatus =
  | { kind: "empty" }
  | { kind: "done" }
  | { kind: "notStarted" }
  /** Open work exists, and every open task waits for an answer or on a blocker. */
  | { kind: "asking" }
  | { kind: "stuck" }
  | { kind: "moving" };

/** An open task that cannot move on its own. Blocked wins over asked. */
export type Held =
  | {
      kind: "blocked";
      task: Subtask;
      /** Blockers that are tasks of this feature. */
      inside: Blocker[];
      /** Blockers in other features. */
      outside: Blocker[];
      hidden: number;
    }
  | { kind: "asked"; task: Subtask; request: PendingRequest };

export type OwnerLoad = { person: Person | null; open: Subtask[] };

export type FeatureSummary = {
  status: FeatureStatus;
  total: number;
  counts: Record<Status, number>;
  held: Held[];
  /** Open tasks that can move now. */
  free: Subtask[];
  /** Who holds open work, most first, unassigned last. */
  owners: OwnerLoad[];
  /** Features that still hold this one up. */
  waitsOn: LinkedTask[];
  /** Features that still wait on this one. */
  blocks: LinkedTask[];
};

function heldOf(task: Subtask, keys: Set<string>): Held | null {
  if (task.status === "done") return null;
  if (isBlocked(task))
    return {
      kind: "blocked",
      task,
      inside: task.waitsOn.filter((b) => keys.has(b.key)),
      outside: task.waitsOn.filter((b) => !keys.has(b.key)),
      hidden: task.hiddenBlockers,
    };
  if (task.pendingRequest)
    return { kind: "asked", task, request: task.pendingRequest };
  return null;
}

function statusOf(parts: {
  total: number;
  open: number;
  started: boolean;
  free: number;
  asked: number;
}): FeatureStatus {
  if (parts.total === 0) return { kind: "empty" };
  if (parts.open === 0) return { kind: "done" };
  if (parts.free === 0)
    return parts.asked > 0 ? { kind: "asking" } : { kind: "stuck" };
  return parts.started ? { kind: "moving" } : { kind: "notStarted" };
}

export function summarizeFeature(
  feature: BoardTask,
  links: { waitsOn: LinkedTask[]; blocks: LinkedTask[] },
): FeatureSummary {
  const tasks = feature.subtasks;
  const keys = new Set(tasks.map((t) => t.key));
  const counts: Record<Status, number> = {
    todo: 0,
    doing: 0,
    review: 0,
    done: 0,
  };
  for (const task of tasks) counts[task.status] += 1;

  const held: Held[] = [];
  const free: Subtask[] = [];
  for (const task of tasks) {
    const h = heldOf(task, keys);
    if (h) held.push(h);
    else if (task.status !== "done") free.push(task);
  }

  const byOwner = new Map<string, OwnerLoad>();
  for (const task of tasks) {
    if (task.status === "done") continue;
    const id = task.assignee?.id ?? "";
    const load = byOwner.get(id) ?? { person: task.assignee, open: [] };
    load.open.push(task);
    byOwner.set(id, load);
  }
  const owners = [...byOwner.values()].sort(
    (a, b) =>
      Number(a.person === null) - Number(b.person === null) ||
      b.open.length - a.open.length,
  );

  return {
    status: statusOf({
      total: tasks.length,
      open: tasks.length - counts.done,
      started: counts.todo < tasks.length,
      free: free.length,
      asked: held.filter((h) => h.kind === "asked").length,
    }),
    total: tasks.length,
    counts,
    held,
    free,
    owners,
    waitsOn: links.waitsOn.filter((x) => x.status !== "done"),
    blocks: links.blocks.filter((x) => x.status !== "done"),
  };
}

/** The column words, in the order the board shows them. */
export const COLUMN_ORDER: Status[] = ["todo", "doing", "review", "done"];
