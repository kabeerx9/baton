import { createHash } from "node:crypto";

/**
 * SHA-256, base64url without padding: the hash the Better Auth plugin
 * stored, so keys it made keep matching (auth-boundary §3 "Tables").
 */
export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("base64url");
}
