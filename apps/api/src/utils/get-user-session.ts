import { identity } from "../identity";

/** The person's own session; an API key header never stands in for one. */
export function getUserSession(headers: Headers) {
  return identity.resolve(headers);
}
