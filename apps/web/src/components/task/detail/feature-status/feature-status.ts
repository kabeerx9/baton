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
 * so this is derived from its tasks, in one place, in this order. Every view
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
  | {
      kind: "asked";
      task: Subtask;
      request: PendingRequest;
      /** Who asked, by name. Null when the member is not known. */
      requester: string | null;
    };

export type OwnerLoad = { person: Person | null; open: Subtask[] };

/** A task in another feature that waits on one of this feature's tasks. */
export type Dependent = { from: string; to: Blocker };

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
  /** Tasks elsewhere that wait on a task of this feature. */
  dependents: Dependent[];
};

/** The column words, in the order the board shows them. */
export const COLUMN_ORDER: Status[] = ["todo", "doing", "review", "done"];

/** A status the page knows. Anything else counts as not started, the safe state. */
export function columnOf(task: { status: string }): Status {
  return COLUMN_ORDER.find((s) => s === task.status) ?? "todo";
}

function heldOf(
  task: Subtask,
  keys: Set<string>,
  memberName: (userId: string) => string | null,
): Held | null {
  if (columnOf(task) === "done") return null;
  if (isBlocked(task))
    return {
      kind: "blocked",
      task,
      inside: task.waitsOn.filter((b) => keys.has(b.key)),
      outside: task.waitsOn.filter((b) => !keys.has(b.key)),
      hidden: task.hiddenBlockers,
    };
  if (task.pendingRequest)
    return {
      kind: "asked",
      task,
      request: task.pendingRequest,
      requester: task.pendingRequest.requestedBy
        ? memberName(task.pendingRequest.requestedBy)
        : null,
    };
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

/** Open tasks in other board items that wait on one of `keys`, once per pair. */
function dependentsOf(keys: Set<string>, others: BoardTask[]): Dependent[] {
  const found = new Map<string, Dependent>();
  const visit = (waiter: {
    id: string;
    key: string;
    title: string;
    status: string;
    assignee: Person | null;
    waitsOn: Blocker[];
  }) => {
    if (columnOf(waiter) === "done") return;
    for (const b of waiter.waitsOn) {
      if (!keys.has(b.key) || keys.has(waiter.key)) continue;
      found.set(`${b.key}>${waiter.key}`, {
        from: b.key,
        to: {
          id: waiter.id,
          key: waiter.key,
          title: waiter.title,
          assigneeName: waiter.assignee?.name ?? null,
        },
      });
    }
  };
  for (const item of others) {
    if (item.subtasks.length === 0) visit(item);
    else {
      // A feature waits through its own links; its tasks wait through theirs.
      visit({ ...item, status: item.column });
      for (const task of item.subtasks) visit(task);
    }
  }
  return [...found.values()];
}

/**
 * The one place a feature's lifecycle is derived. `boardTasks` is every item
 * the page's board lists, so links to tasks outside this feature are found
 * without a fetch. `memberName` turns a user id into a name.
 */
export function summarizeFeature(
  feature: BoardTask,
  context: {
    waitsOn: LinkedTask[];
    blocks: LinkedTask[];
    boardTasks: BoardTask[];
    memberName: (userId: string) => string | null;
  },
): FeatureSummary {
  const tasks = feature.subtasks;
  const keys = new Set(tasks.map((t) => t.key));
  const counts: Record<Status, number> = {
    todo: 0,
    doing: 0,
    review: 0,
    done: 0,
  };
  for (const task of tasks) counts[columnOf(task)] += 1;

  const held: Held[] = [];
  const free: Subtask[] = [];
  for (const task of tasks) {
    const h = heldOf(task, keys, context.memberName);
    if (h) held.push(h);
    else if (columnOf(task) !== "done") free.push(task);
  }

  const byOwner = new Map<string, OwnerLoad>();
  for (const task of tasks) {
    if (columnOf(task) === "done") continue;
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

  const waitsOn = context.waitsOn.filter((x) => x.status !== "done");
  const blocks = context.blocks.filter((x) => x.status !== "done");
  const dependents = dependentsOf(
    keys,
    context.boardTasks.filter((item) => item.id !== feature.id),
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
    waitsOn,
    blocks,
    dependents,
  };
}
