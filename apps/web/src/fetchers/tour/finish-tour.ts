import { client } from "@baton/libs";
import { HttpError } from "@/lib/http-error";
import type { TourOutcome } from "./types";

/** Idempotent. Deletes the demo workspace on the server. */
export async function finishTour(outcome: TourOutcome) {
  const response = await client.tour.finish.$post({ json: { outcome } });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}
