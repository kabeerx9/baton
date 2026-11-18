import { APIError, type getSessionFromCtx } from "better-auth/api";
import { apiKeyDenialHeaders } from "./rate-limit-headers";
import { verifyApiKey } from "./verify-api-key";

type AuthContext = Parameters<typeof getSessionFromCtx>[0];

/**
 * An API key works on `/api/auth/get-session` only; every other provider
 * path needs a person's session. P4 removes this with the key plugin.
 */
export async function assertNativeAuthApiKeyAllowed(ctx: AuthContext) {
  const credential = ctx.headers?.get("x-api-key");
  if (!credential) return;
  if (ctx.path !== "/get-session") {
    throw new APIError("FORBIDDEN", {
      code: "SESSION_REQUIRED",
      message: "A user session is required",
    });
  }
  const verified = await verifyApiKey(credential, { consume: false });
  if (verified && verified.status !== "valid") {
    throw new APIError(
      "TOO_MANY_REQUESTS",
      {
        code: "RATE_LIMITED",
        message:
          verified.status === "rate_limited"
            ? "Rate limit exceeded"
            : "API key usage limit exceeded",
      },
      apiKeyDenialHeaders(verified, new Date()),
    );
  }
  if (verified?.status !== "valid") {
    throw new APIError("UNAUTHORIZED", {
      code: "INVALID_API_KEY",
      message: "Invalid API key",
    });
  }
}
