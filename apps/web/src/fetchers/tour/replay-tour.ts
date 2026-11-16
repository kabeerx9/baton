import { tourRequest } from "./tour-request";

export function replayTour() {
  return tourRequest<{ completed: false }>("/replay", { method: "POST" });
}
