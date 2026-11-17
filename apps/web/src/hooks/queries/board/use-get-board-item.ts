import { useQuery } from "@tanstack/react-query";
import getBoardItem from "@/fetchers/board/get-board-item";

/**
 * The board item for a task page. The key sits under `["task-board"]`, so the
 * socket and every status write refresh it with the board.
 */
export function useGetBoardItem(workspaceId: string, taskId: string) {
  return useQuery({
    queryKey: ["task-board", workspaceId, "item", taskId],
    queryFn: () => getBoardItem(workspaceId, taskId),
    enabled: !!workspaceId && !!taskId,
  });
}
