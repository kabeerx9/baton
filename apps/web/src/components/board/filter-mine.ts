import type { BoardTask } from "./model";

/** What the board shows: every card, or only the cards that involve the signed-in user. */
export type BoardView = "all" | "mine";

/**
 * A card involves the user when they are the assignee of the task or of any
 * of its visible subtasks. The card keeps all its subtasks for context.
 * With no user id (session not loaded), nothing matches.
 */
export function filterMine(
  boardTasks: BoardTask[],
  userId: string | undefined,
): BoardTask[] {
  if (!userId) return [];
  return boardTasks.filter(
    (task) =>
      task.assignee?.id === userId ||
      task.subtasks.some((subtask) => subtask.assignee?.id === userId),
  );
}

/** The cards for one view. */
export function applyView(
  view: BoardView,
  boardTasks: BoardTask[],
  userId: string | undefined,
): BoardTask[] {
  return view === "mine" ? filterMine(boardTasks, userId) : boardTasks;
}
