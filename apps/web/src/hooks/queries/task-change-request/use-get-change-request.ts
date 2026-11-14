import { useQuery } from "@tanstack/react-query";
import getChangeRequest from "@/fetchers/task-change-request/get-change-request";

export const changeRequestKey = (id: string) => ["change-request", id] as const;

/** The full request: when it was made and which status it left. Read only when a banner shows. */
export function useGetChangeRequest(id: string | undefined) {
  return useQuery({
    queryKey: changeRequestKey(id ?? ""),
    queryFn: () => getChangeRequest(id ?? ""),
    enabled: Boolean(id),
    staleTime: 0,
  });
}
