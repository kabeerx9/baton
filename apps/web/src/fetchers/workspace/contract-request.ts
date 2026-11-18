import { windowId } from "@baton/libs";
import { getApiUrl } from "@/fetchers/get-api-url";
import { HttpError } from "@/lib/http-error";

// TODO(p3-api): switch to client type. The P3 write routes are not in the
// typed client yet; each caller goes back to `client.workspace…` when they are.
export async function contractRequest<T>(
  method: "POST" | "PATCH" | "PUT" | "DELETE" | "GET",
  path: string,
  body?: unknown,
): Promise<T> {
  const response = await fetch(getApiUrl(path), {
    method,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      "X-Baton-Window-Id": windowId,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) throw await HttpError.fromResponse(response);
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}
