import { useQuery } from "@tanstack/react-query";
import getTeamHistory from "@/fetchers/board/get-team-history";

export function useGetTeamHistory(workspaceId: string, days: number) {
  return useQuery({
    queryKey: ["team-history", workspaceId, days],
    queryFn: () => getTeamHistory(workspaceId, days),
    enabled: !!workspaceId,
  });
}
