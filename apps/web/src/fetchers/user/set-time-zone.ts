import { client } from "@baton/libs";
import { HttpError } from "@/lib/http-error";

export async function setTimeZone(timeZone: string) {
  const response = await client.user["time-zone"].$put({ json: { timeZone } });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}
