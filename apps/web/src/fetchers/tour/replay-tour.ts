import { client } from "@baton/libs";
import { HttpError } from "@/lib/http-error";

export async function replayTour() {
  const response = await client.tour.replay.$post();
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}
