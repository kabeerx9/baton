import { useQuery } from "@tanstack/react-query";
import getBoard from "@/fetchers/board/get-board";

export function useGetBoard(workspaceId: string) {
  return useQuery({
    queryKey: ["task-board", workspaceId],
    queryFn: () => getBoard(workspaceId),
    enabled: !!workspaceId,
  });
}
