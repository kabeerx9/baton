import type {
  Blocker,
  BoardTask,
  Person,
  Status,
  Subtask,
} from "@/components/board/model";
import type { PendingRequest } from "@/components/task/change-request/describe-pending";

/** A task under a feature, shaped like the board read after `buildBoard`. */
export function makeTask(init: {
  key: string;
  title: string;
  status: Status;
  owner: Person | null;
  waitsOn?: Blocker[];
  blockedBy?: string[];
  request?: PendingRequest | null;
}): Subtask {
  const slug = init.key.split("-")[0]?.toLowerCase() ?? "t";
  return {
    id: `id-${init.key}`,
    key: init.key,
    title: init.title,
    projectId: `project-${slug}`,
    status: init.status,
    priority: null,
    dueDate: null,
    finishedAt: init.status === "done" ? "2026-11-17T10:00:00.000Z" : null,
    assignee: init.owner,
    pr: null,
    blockedBy: init.blockedBy ?? [],
    waitsOn: init.waitsOn ?? [],
    hiddenBlockers: 0,
    pendingRequest: init.request ?? null,
    move: "apply",
  };
}

/** The open blocker a task carries in `waitsOn`. */
export function blockerOf(
  task: { id: string; key: string; title: string },
  owner: Person | null,
): Blocker {
  return {
    id: task.id,
    key: task.key,
    title: task.title,
    assigneeName: owner?.name ?? null,
  };
}

/** BOARD.md rule 3: a feature's column follows its tasks. */
export function columnOf(tasks: Subtask[]): Status {
  if (tasks.length === 0) return "todo";
  if (tasks.every((t) => t.status === "done")) return "done";
  const open = tasks.filter((t) => t.status !== "done");
  if (open.every((t) => t.status === "review")) return "review";
  return tasks.some((t) => t.status !== "todo") ? "doing" : "todo";
}

/** A board item that holds tasks, with the column its tasks decide. */
export function makeFeature(init: {
  key: string;
  title: string;
  summary: string;
  owner: Person | null;
  subtasks: Subtask[];
  waitsOn?: Blocker[];
}): BoardTask {
  return {
    id: `id-${init.key}`,
    key: init.key,
    title: init.title,
    summary: init.summary,
    projectId: "project-board",
    // The feature's own status is ignored (BOARD.md rule 3).
    status: "todo",
    priority: null,
    dueDate: null,
    finishedAt: null,
    assignee: init.owner,
    column: columnOf(init.subtasks),
    waitsOn: init.waitsOn ?? [],
    hiddenBlockers: 0,
    pendingRequest: null,
    move: "apply",
    subtasks: init.subtasks,
  };
}
