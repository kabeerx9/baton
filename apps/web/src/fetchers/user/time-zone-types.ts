// Shapes from the user-timezone contract, section 3. Hand-written until the
// backend merges; then derive them from the client with InferResponseType.

/** GET /api/user/me. `timeZone` is null until the person answers. */
export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  role: string | null;
  timeZone: string | null;
};

/** PUT /api/user/time-zone, 200. */
export type UserTimeZone = { timeZone: string };
