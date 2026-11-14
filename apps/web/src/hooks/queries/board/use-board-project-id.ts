import { useQuery } from "@tanstack/react-query";
import getBoard from "@/fetchers/board/get-board";

/**
 * The id of the workspace's hidden board project, or undefined until the board
 * is known. It shares the board query, so it adds no request.
 */
export function useBoardProjectId(workspaceId: string) {
  return useQuery({
    queryKey: ["task-board", workspaceId],
    queryFn: () => getBoard(workspaceId),
    enabled: !!workspaceId,
    select: (board) => board.projects.find((p) => p.kind === "board")?.id,
  }).data;
}
