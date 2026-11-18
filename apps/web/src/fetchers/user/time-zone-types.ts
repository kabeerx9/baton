import type { client } from "@baton/libs";
import type { InferResponseType } from "hono/client";

// Derived from the API, so the contract cannot drift from the server.

/** GET /api/user/me. `timeZone` is null until the person answers. */
export type CurrentUser = InferResponseType<typeof client.user.me.$get, 200>;

/** PUT /api/user/time-zone, 200. */
export type UserTimeZone = InferResponseType<
  (typeof client.user)["time-zone"]["$put"],
  200
>;
