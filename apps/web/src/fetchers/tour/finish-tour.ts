import { tourRequest } from "./tour-request";
import type { TourOutcome } from "./types";

/** Idempotent. Deletes the demo workspace on the server. */
export function finishTour(outcome: TourOutcome) {
  return tourRequest<{ completed: true }>("/finish", {
    method: "POST",
    body: { outcome },
  });
}
