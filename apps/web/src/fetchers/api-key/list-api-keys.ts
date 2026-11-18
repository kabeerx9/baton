import { client } from "@baton/libs";
import { HttpError } from "@/lib/http-error";

export async function listApiKeys() {
  const response = await client["api-key"].$get();
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}
