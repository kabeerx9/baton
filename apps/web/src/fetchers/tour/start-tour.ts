import { tourRequest } from "./tour-request";
import type { TourStart } from "./types";

/** Resets and seeds a fresh demo workspace. 409 when the tour is completed. */
export function startTour() {
  return tourRequest<TourStart>("/start", { method: "POST" });
}
