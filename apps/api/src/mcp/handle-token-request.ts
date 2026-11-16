import type { Context } from "hono";
import { refreshGrant } from "./grant/refresh-grant";
import { exchangeCode } from "./oauth";
import { parseTokenRequest } from "./parse-token-request";
import { takeTokenAttempt } from "./token-attempts";

// RFC 6749 section 5.1: token responses must not be cached.
const NO_STORE = { "Cache-Control": "no-store", Pragma: "no-cache" };

async function readParams(c: Context): Promise<Record<string, unknown> | null> {
  const contentType = c.req.header("content-type") || "";
  try {
    if (contentType.includes("application/x-www-form-urlencoded")) {
      return Object.fromEntries(new URLSearchParams(await c.req.text()));
    }
    const input: unknown = await c.req.json();
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      return null;
    }
    return input as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** POST /api/mcp/token: authorization_code and refresh_token grants. */
export async function handleTokenRequest(c: Context) {
  const error = (code: string, status: 400 | 429 = 400) =>
    c.json({ error: code }, status, {
      ...NO_STORE,
      ...(status === 429 ? { "Retry-After": "60" } : {}),
    });

  const params = await readParams(c);
  if (!params) return error("invalid_request");
  const request = parseTokenRequest(params);
  if (request.kind === "error") return error(request.error);
  if (!(await takeTokenAttempt(request.clientId))) {
    return error("temporarily_unavailable", 429);
  }

  const tokens =
    request.kind === "authorization_code"
      ? await exchangeCode(
          request.code,
          request.clientId,
          request.codeVerifier,
          request.redirectUri,
        )
      : await refreshGrant(request.refreshToken, request.clientId).then(
          (result) => (result.kind === "issued" ? result.tokens : null),
        );
  if (!tokens) return error("invalid_grant");

  return c.json(
    {
      access_token: tokens.accessToken,
      token_type: "Bearer",
      expires_in: tokens.expiresIn,
      refresh_token: tokens.refreshToken,
    },
    200,
    NO_STORE,
  );
}
