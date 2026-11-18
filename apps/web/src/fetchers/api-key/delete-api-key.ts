import { client } from "@baton/libs";
import { HttpError } from "@/lib/http-error";

export async function deleteApiKey(id: string) {
  const response = await client["api-key"][":id"].$delete({ param: { id } });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}
