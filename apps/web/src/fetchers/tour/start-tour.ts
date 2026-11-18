import { client } from "@baton/libs";
import { HttpError } from "@/lib/http-error";

/** Returns the running tour's demo workspace, seeding one if needed. 409 when the tour is completed. */
export async function startTour() {
  const response = await client.tour.start.$post();
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}
