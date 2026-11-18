import * as Sentry from "@sentry/node";
import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { identity } from "../identity";
import type { Caller } from "../identity/port";
import { isMcpToken } from "../mcp/grant/token-secret";
import { verifyAccessToken } from "../mcp/grant/verify-access-token";
import { apiKeyRejection } from "./api-key-rejection";
import { primeInstanceRole } from "./is-instance-admin";
import { type ApiKeyRateLimit, rateLimitHeaders } from "./rate-limit-headers";
import type { AuthMethod } from "./request-channel";
import { verifyApiKey } from "./verify-api-key";

// User is tagged on Sentry's isolation scope; the per-request isolation
// scope is forked by Sentry.withIsolationScope in the api.use("*", ...)
// middleware, so this only affects the in-flight request.
function attachUserToScope(userId: string) {
  Sentry.setUser({ id: userId });
}

function resolveBearerOnly(c: Context) {
  const headers = new Headers(c.req.raw.headers);
  headers.delete("cookie");
  return identity.resolve(headers);
}

function setCallerContext(c: Context, caller: Caller | null) {
  c.set("identity", caller?.identity ?? null);
  c.set("sessionId", caller?.sessionId ?? null);
  c.set("userId", caller?.identity.userId ?? "");
  c.set("userEmail", caller?.identity.email ?? "");
  if (caller && caller.instanceRole !== undefined)
    primeInstanceRole(c.req.raw, caller.instanceRole);
}

function parseBearerToken(authHeader: string | undefined): {
  token: string | null;
  malformed: boolean;
} {
  if (!authHeader) {
    return { token: null, malformed: false };
  }

  if (!authHeader.match(/^Bearer\b/i)) {
    return { token: null, malformed: false };
  }

  const match = authHeader.match(/^Bearer\s+(\S+)$/i);
  if (!match) {
    return { token: null, malformed: true };
  }

  return {
    token: match[1] ?? null,
    malformed: false,
  };
}

function setRateLimitHeaders(c: Context, rateLimit: ApiKeyRateLimit | null) {
  if (rateLimit) c.set("apiKeyHeaders", rateLimitHeaders(rateLimit));
}

type VerifiedApiKey = Extract<
  Awaited<ReturnType<typeof verifyApiKey>>,
  { status: "valid" }
>;

function setApiKeyContext(c: Context, { key, rateLimit }: VerifiedApiKey) {
  c.set("authMethod", "api_key" satisfies AuthMethod);
  c.set("userId", key.userId);
  c.set("userEmail", "");
  c.set("identity", null);
  c.set("sessionId", null);
  c.set("apiKey", {
    id: key.id,
    userId: key.userId,
    enabled: key.enabled,
    permissions: key.permissions,
  });
  setRateLimitHeaders(c, rateLimit);
  attachUserToScope(key.userId);
}

/**
 * MCP tools call REST with the agent's access token. It acts as its user, like
 * an API key without a scope, but never as a browser session: session-only
 * routes refuse it, and so do WebSocket upgrades, which revocation cannot close.
 */
async function setMcpTokenContext(c: Context, token: string) {
  const grant =
    c.req.header("upgrade")?.toLowerCase() === "websocket"
      ? null
      : await verifyAccessToken(token);
  if (!grant) throw new HTTPException(401, { message: "Unauthorized" });
  c.set("authMethod", "mcp" satisfies AuthMethod);
  c.set("userId", grant.userId);
  c.set("userEmail", "");
  c.set("identity", null);
  c.set("sessionId", null);
  attachUserToScope(grant.userId);
}

export async function authenticateApiRequest(c: Context): Promise<void> {
  const { token, malformed } = parseBearerToken(c.req.header("Authorization"));
  if (malformed) {
    throw new HTTPException(401, { message: "Unauthorized" });
  }

  const apiKeyHeader = c.req.header("x-api-key")?.trim();
  if (!token && apiKeyHeader) {
    const apiKeyResult = await verifyApiKey(apiKeyHeader);
    if (apiKeyResult?.status !== "valid") {
      throw apiKeyRejection(apiKeyResult);
    }
    setApiKeyContext(c, apiKeyResult);
    return;
  }

  if (token && isMcpToken(token)) {
    await setMcpTokenContext(c, token);
    return;
  }

  if (token) {
    const apiKeyResult = await verifyApiKey(token);
    if (apiKeyResult?.status === "valid") {
      setApiKeyContext(c, apiKeyResult);
      return;
    }
    if (apiKeyResult) {
      throw apiKeyRejection(apiKeyResult);
    }
    const caller = await resolveBearerOnly(c);
    if (caller) {
      c.set("authMethod", "bearer" satisfies AuthMethod);
      setCallerContext(c, caller);
      attachUserToScope(caller.identity.userId);
      return;
    }
    throw new HTTPException(401, { message: "Unauthorized" });
  }

  const caller = await identity.resolve(c.req.raw.headers);
  setCallerContext(c, caller);

  if (!caller) {
    throw new HTTPException(401, { message: "Unauthorized" });
  }

  c.set("authMethod", "cookie" satisfies AuthMethod);
  attachUserToScope(caller.identity.userId);
}

export async function resolveAssetBearerOrCookie(c: Context): Promise<{
  userId: string;
  apiKeyId?: string;
  apiKeyPermissions?: Record<string, string[]> | null;
}> {
  const { token, malformed } = parseBearerToken(c.req.header("Authorization"));
  if (malformed) {
    throw new HTTPException(401, { message: "Unauthorized" });
  }

  const apiKeyHeader = c.req.header("x-api-key")?.trim();
  if (!token && apiKeyHeader) {
    const apiKeyResult = await verifyApiKey(apiKeyHeader);
    if (apiKeyResult?.status !== "valid") {
      throw apiKeyRejection(apiKeyResult);
    }
    setRateLimitHeaders(c, apiKeyResult.rateLimit);
    return {
      userId: apiKeyResult.key.userId,
      apiKeyId: apiKeyResult.key.id,
      apiKeyPermissions: apiKeyResult.key.permissions,
    };
  }

  if (token) {
    const apiKeyResult = await verifyApiKey(token);
    if (apiKeyResult?.status === "valid") {
      setRateLimitHeaders(c, apiKeyResult.rateLimit);
      return {
        userId: apiKeyResult.key.userId,
        apiKeyId: apiKeyResult.key.id,
        apiKeyPermissions: apiKeyResult.key.permissions,
      };
    }
    if (apiKeyResult) {
      throw apiKeyRejection(apiKeyResult);
    }
    const caller = await resolveBearerOnly(c);
    if (caller) return { userId: caller.identity.userId };
    throw new HTTPException(401, { message: "Unauthorized" });
  }

  const caller = await identity.resolve(c.req.raw.headers);
  if (!caller) {
    throw new HTTPException(401, { message: "Unauthorized" });
  }

  return { userId: caller.identity.userId };
}
