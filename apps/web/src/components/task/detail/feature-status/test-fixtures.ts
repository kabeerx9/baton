import type {
  Blocker,
  BoardTask,
  Person,
  Status,
  Subtask,
} from "@/components/board/model";
import type { PendingRequest } from "@/components/task/change-request/describe-pending";

/** Test builders for board items shaped like the board read after `buildBoard`. */
export const person = (id: string, name: string): Person => ({
  id,
  name,
  initials: name.slice(0, 1),
  hue: 200,
  image: null,
});

export function task(init: {
  key: string;
  status?: Status;
  owner?: Person | null;
  waitsOn?: Blocker[];
  hiddenBlockers?: number;
  request?: PendingRequest | null;
}): Subtask {
  return {
    id: `id-${init.key}`,
    key: init.key,
    title: `Title ${init.key}`,
    projectId: "p",
    status: init.status ?? "todo",
    priority: null,
    dueDate: null,
    finishedAt: null,
    assignee: init.owner ?? null,
    pr: null,
    blockedBy: [],
    waitsOn: init.waitsOn ?? [],
    hiddenBlockers: init.hiddenBlockers ?? 0,
    pendingRequest: init.request ?? null,
    move: "apply",
  };
}

export const blockerOf = (t: Subtask): Blocker => ({
  id: t.id,
  key: t.key,
  title: t.title,
  assigneeName: t.assignee?.name ?? null,
});

export function feature(key: string, subtasks: Subtask[]): BoardTask {
  return {
    id: `id-${key}`,
    key,
    title: `Title ${key}`,
    summary: "",
    projectId: "board",
    status: "todo",
    priority: null,
    dueDate: null,
    finishedAt: null,
    assignee: null,
    column: "todo",
    waitsOn: [],
    hiddenBlockers: 0,
    pendingRequest: null,
    move: "apply",
    subtasks,
  };
}

export const request = (requestedBy: string | null): PendingRequest => ({
  id: "r",
  kind: "status",
  targetStatus: "done",
  requestedBy,
  channel: "web",
  expiresAt: "2026-11-20T00:00:00.000Z",
});
