import { getApiUrl } from "@/fetchers/get-api-url";
import { HttpError } from "@/lib/http-error";

/**
 * Revokes one grant. A 404 means the grant is already gone (revoked elsewhere
 * or expired), which is the outcome the caller wanted, so it resolves.
 */
export async function revokeMcpGrant(id: string): Promise<void> {
  const response = await fetch(
    getApiUrl(`/mcp/grants/${encodeURIComponent(id)}`),
    { method: "DELETE", credentials: "include" },
  );
  if (response.ok || response.status === 404) return;
  throw await HttpError.fromResponse(response);
}
