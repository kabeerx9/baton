import { auth } from "../identity/better-auth/auth";

export function getUserSession(headers: Headers) {
  const sessionHeaders = new Headers(headers);
  sessionHeaders.delete("x-api-key");
  return auth.api.getSession({ headers: sessionHeaders });
}
