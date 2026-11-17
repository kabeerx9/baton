import { orderCards } from "./card-order";
import type { BoardTask, Status } from "./model";

/** Board columns, left to right. */
export const COLUMNS: Status[] = ["todo", "doing", "review", "done"];

export type ColumnItems = {
  status: Status;
  /** The cards the column shows, in display order. */
  items: BoardTask[];
  /** Done only: the server's count of finished cards left out of the window. */
  olderCount: number;
};

/**
 * What each column shows and in which order. The server has already left out
 * done work older than the window and counted it (`olderDoneCount`). One
 * derivation for the whole board, so keyboard navigation and rendering agree
 * on card positions.
 */
export function columnOrder(
  boardTasks: BoardTask[],
  today: number,
  olderDoneCount: number,
): ColumnItems[] {
  return COLUMNS.map((status) => {
    const items = orderCards(
      boardTasks.filter((task) => task.column === status),
      (task) => ({
        key: task.key,
        priority: task.priority,
        dueDate: task.dueDate,
        done: task.column === "done",
      }),
      today,
    );
    return {
      status,
      items,
      olderCount: status === "done" ? olderDoneCount : 0,
    };
  });
}
