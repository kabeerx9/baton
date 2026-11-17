import type { BoardResponse } from "@/fetchers/board/get-board";

type Item = BoardResponse["tasks"][number];

/**
 * The board read plus the one item the task page asked for. The board leaves
 * out old done work, so a feature finished long ago is only in the item read.
 * The board's copy wins when both have it: they are the same read, and the
 * board is the one the socket refreshes.
 */
export function withItem(
  board: BoardResponse,
  item: Item | null | undefined,
): BoardResponse {
  if (!item || board.tasks.some((task) => task.id === item.id)) return board;
  return { ...board, tasks: [...board.tasks, item] };
}
