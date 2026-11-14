import { orderCards } from "./card-order";
import { splitDone } from "./done-window";
import type { BoardTask, Status } from "./model";

/** Board columns, left to right. */
export const COLUMNS: Status[] = ["todo", "doing", "review", "done"];

export type ColumnItems = {
  status: Status;
  /** The cards the column shows, in display order. */
  items: BoardTask[];
  /** Done only: finished work older than the Done window. */
  olderCount: number;
};

/**
 * What each column shows and in which order. Done keeps 14 calendar days
 * counted from local midnight (accepted policy). One derivation for the whole
 * board, so keyboard navigation and rendering agree on card positions.
 */
export function columnOrder(
  boardTasks: BoardTask[],
  today: number,
): ColumnItems[] {
  return COLUMNS.map((status) => {
    const all = boardTasks.filter((task) => task.column === status);
    const { recent, olderCount } =
      status === "done"
        ? splitDone(all, new Date(today))
        : { recent: all, olderCount: 0 };
    const items = orderCards(
      recent,
      (task) => ({
        key: task.key,
        priority: task.priority,
        dueDate: task.dueDate,
        done: task.column === "done",
      }),
      today,
    );
    return { status, items, olderCount };
  });
}
