import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { ApiError } from "../errors/api-error";
import { identity } from "../identity";
import { isMcpToken } from "../mcp/grant/token-secret";
import { withJsonNotFound } from "../errors/not-found-response";
import { withJsonRateLimit } from "../errors/rate-limit-response";
import { isStoredApiKey } from "../api-key/is-stored-api-key";

const sessionRequired = () =>
  new ApiError(403, {
    code: "SESSION_REQUIRED",
    message: "A user session is required",
  });

/**
 * The provider's routes are a person's: an API key, valid or not, is refused
 * on every /api/auth path before it reaches the provider, and spends no
 * quota. `GET /api/user/me` answers "who am I" for a key.
 */
export async function forwardAuthRequest(c: Context): Promise<Response> {
  c.header("Cache-Control", "no-store");
  const headers = new Headers(c.req.raw.headers);
  const bearerToken = headers
    .get("authorization")
    ?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (headers.get("x-api-key")?.trim()) throw sessionRequired();
  // MCP access tokens reach REST for the tools, never the auth API: they must
  // not read sessions or manage the account.
  if (bearerToken && isMcpToken(bearerToken)) {
    throw new HTTPException(401, { message: "Unauthorized" });
  }
  if (bearerToken) {
    if (await isStoredApiKey(bearerToken)) throw sessionRequired();
    // Explicit bearer credentials never fall back to a browser's cookie.
    headers.delete("cookie");
    if (!(await identity.resolve(headers))) {
      throw new HTTPException(401, { message: "Unauthorized" });
    }
  }
  return withJsonRateLimit(
    await withJsonNotFound(
      await identity.handle(new Request(c.req.raw, { headers })),
    ),
  );
}
