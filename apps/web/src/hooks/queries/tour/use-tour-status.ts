import { useQuery } from "@tanstack/react-query";
import { getTour } from "@/fetchers/tour/get-tour";

export const TOUR_QUERY_KEY = ["tour"] as const;

/**
 * Whether this user still owes the tour. Never refetched on focus: a refetch
 * moves `dataUpdatedAt`, which the gate reads as "replay requested".
 */
export function useTourStatus() {
  return useQuery({
    queryKey: TOUR_QUERY_KEY,
    queryFn: getTour,
    staleTime: Number.POSITIVE_INFINITY,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
  });
}
