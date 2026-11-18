import { client } from "@baton/libs";
import { HttpError } from "@/lib/http-error";

export async function getCurrentUser() {
  const response = await client.user.me.$get();
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json();
}
