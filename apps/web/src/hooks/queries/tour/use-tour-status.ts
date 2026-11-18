import { useQuery } from "@tanstack/react-query";
import { getTour } from "@/fetchers/tour/get-tour";

export const TOUR_QUERY_KEY = ["tour"] as const;

/**
 * Refetch on focus and reconnect only after a failure. On success a refetch
 * moves `dataUpdatedAt`, which the gate reads as "replay requested", so a
 * good status is never refetched.
 */
export const refetchWhileFailed = (query: { state: { status: string } }) =>
  query.state.status === "error";

/**
 * Whether this user still owes the tour. While loading or failed there is no
 * answer, and callers treat that as "do not show" (the safe state). A failure
 * retries with backoff, then waits for focus or reconnect; one bad request
 * must not switch the tour off for the session.
 */
export function useTourStatus() {
  return useQuery({
    queryKey: TOUR_QUERY_KEY,
    queryFn: getTour,
    staleTime: Number.POSITIVE_INFINITY,
    retry: 3,
    refetchOnWindowFocus: refetchWhileFailed,
    refetchOnReconnect: refetchWhileFailed,
  });
}
