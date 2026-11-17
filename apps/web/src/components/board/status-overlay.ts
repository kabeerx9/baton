import type { BoardResponse } from "@/fetchers/board/get-board";
import { overlayTarget } from "@/store/task-status/transition";
import type { Entry } from "@/store/task-status/types";
import { toStatus } from "./model";

type Item = BoardResponse["tasks"][number];
type Sub = Item["subtasks"][number];
type Entries = Record<string, Entry>;

type Statused = {
  id: string;
  status: string;
  isCompleted: boolean;
  finishedAt: string | null;
  statusGeneration: number;
};

/** A task or subtask with the status its entry says to show. */
function overlayStatus<T extends Statused>(
  item: T,
  entries: Entries,
  now: string,
): T {
  const target = overlayTarget(item, entries[item.id]);
  if (!target) return item;
  return {
    ...item,
    status: target.status,
    isCompleted: target.isFinal,
    finishedAt: target.isFinal ? (item.finishedAt ?? now) : null,
  };
}

/**
 * The board as the person sees it before the server answers. One function for
 * the board read and the item read: it changes shown status only and never
 * adds or removes an item.
 *
 * A plain top-level card moves its column with its status. A feature's column
 * comes from its tasks (BOARD.md rule 3, decided by the API), so it waits for
 * the refetch.
 */
export function overlayBoardItems<T extends Item>(
  tasks: T[],
  entries: Entries,
  now: string,
): T[] {
  if (Object.keys(entries).length === 0) return tasks;
  return tasks.map((task) => {
    const subtasks = task.subtasks.map((s: Sub) =>
      overlayStatus(s, entries, now),
    );
    const own =
      task.subtasks.length === 0 ? overlayStatus(task, entries, now) : task;
    const column =
      task.subtasks.length === 0 && own !== task ? toStatus(own) : task.column;
    return { ...own, subtasks, column };
  });
}

export function overlayBoard(
  data: BoardResponse,
  entries: Entries,
  now: string,
): BoardResponse {
  const tasks = overlayBoardItems(data.tasks, entries, now);
  return tasks === data.tasks ? data : { ...data, tasks };
}

/**
 * What the board read says about moving one task, for a control that holds
 * only a related task. A task the board does not list gives nothing, and a
 * caller then treats the move as a request.
 */
export function statusFactsOf(
  data: BoardResponse | undefined,
  id: string,
): { statusChange?: { move: string }; statusGeneration?: number } {
  for (const task of data?.tasks ?? []) {
    const hit = task.id === id ? task : task.subtasks.find((s) => s.id === id);
    if (hit) {
      return {
        statusChange: hit.statusChange,
        statusGeneration: hit.statusGeneration,
      };
    }
  }
  return {};
}
