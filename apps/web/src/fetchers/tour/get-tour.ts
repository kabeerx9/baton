import { tourRequest } from "./tour-request";
import type { TourStatus } from "./types";

export function getTour() {
  return tourRequest<TourStatus>("");
}
