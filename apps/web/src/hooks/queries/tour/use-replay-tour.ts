import { useMutation, useQueryClient } from "@tanstack/react-query";
import { replayTour } from "@/fetchers/tour/replay-tour";
import type { TourStatus } from "@/fetchers/tour/types";
import { TOUR_QUERY_KEY } from "./use-tour-status";

/**
 * Clears the completed flag, then flips the cached status. The tour gate
 * sees `completed: false` with a newer `dataUpdatedAt` and starts the tour.
 */
export function useReplayTour() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: replayTour,
    onSuccess: () => {
      queryClient.setQueryData<TourStatus>(TOUR_QUERY_KEY, {
        completed: false,
        demoWorkspace: null,
      });
    },
  });
}
