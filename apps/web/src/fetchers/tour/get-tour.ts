import { client } from "@baton/libs";
import { HttpError } from "@/lib/http-error";

export async function getTour() {
  const response = await client.tour.$get();
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}
