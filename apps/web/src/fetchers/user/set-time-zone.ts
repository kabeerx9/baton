import type { UserTimeZone } from "./time-zone-types";

export async function setTimeZone(timeZone: string): Promise<UserTimeZone> {
  // TODO(user-timezone): after the backend merges, call
  // `client.user["time-zone"].$put({ json: { timeZone } })`, throw
  // `HttpError.fromResponse` when not ok, and return `response.json()`.
  void timeZone;
  throw new Error("setTimeZone is not wired to the API yet");
}
