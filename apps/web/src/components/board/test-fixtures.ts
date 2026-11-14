import type { Blocker, BoardTask, Subtask } from "./model";

export const blocker = (
  key: string,
  assigneeName: string | null = null,
): Blocker => ({ id: key.toLowerCase(), key, title: key, assigneeName });

/** A subtask with safe defaults. Tests override only what they read. */
export const subtaskFixture = (
  id: string,
  over: Partial<Subtask> = {},
): Subtask => ({
  id,
  key: id.toUpperCase(),
  title: id,
  projectId: "p",
  status: "todo",
  priority: null,
  dueDate: null,
  finishedAt: null,
  assignee: null,
  pr: null,
  waitsOn: [],
  hiddenBlockers: 0,
  blockedBy: [],
  ...over,
});

export const boardTaskFixture = (
  id: string,
  over: Partial<BoardTask> = {},
): BoardTask => ({
  id,
  key: id.toUpperCase(),
  title: id,
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
  subtasks: [],
  ...over,
});
