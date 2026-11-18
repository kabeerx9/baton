import type { client } from "@baton/libs";
import type { InferRequestType, InferResponseType } from "hono/client";

// Derived from the API, so the contract cannot drift from the server.

/** GET /api/api-key: one key, never its secret. */
export type ApiKey = InferResponseType<
  (typeof client)["api-key"]["$get"],
  200
>[number];

/** POST /api/api-key body. */
export type CreateApiKeyRequest = InferRequestType<
  (typeof client)["api-key"]["$post"]
>["json"];

/** POST /api/api-key, 201: the key and its secret, shown once. */
export type CreateApiKeyResponse = InferResponseType<
  (typeof client)["api-key"]["$post"],
  201
>;
