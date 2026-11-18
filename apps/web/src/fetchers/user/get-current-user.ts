import type { CurrentUser } from "./time-zone-types";

export async function getCurrentUser(): Promise<CurrentUser> {
  // TODO(user-timezone): after the backend merges, call `client.user.me.$get()`,
  // throw `HttpError.fromResponse` when not ok, and return `response.json()`.
  throw new Error("getCurrentUser is not wired to the API yet");
}
