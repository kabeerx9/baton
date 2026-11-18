import { client } from "@baton/libs";
import { HttpError } from "@/lib/http-error";
import type { CreateApiKeyRequest } from "@/types/api-key";

/** The only response that carries the secret. */
export async function createApiKey(input: CreateApiKeyRequest) {
  const response = await client["api-key"].$post({ json: input });
  if (response.status !== 201) throw await HttpError.fromResponse(response);
  return response.json();
}
