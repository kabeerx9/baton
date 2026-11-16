import { getApiUrl } from "@/fetchers/get-api-url";
import { HttpError } from "@/lib/http-error";

/** One JSON call to `/api/tour/*` with the session cookie. */
export async function tourRequest<T>(
  path: string,
  init?: { method: "POST"; body?: unknown },
): Promise<T> {
  const response = await fetch(getApiUrl(`/tour${path}`), {
    method: init?.method ?? "GET",
    credentials: "include",
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  return response.json() as Promise<T>;
}
