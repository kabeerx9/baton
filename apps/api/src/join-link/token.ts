import { createHash, randomBytes } from "node:crypto";

// 32 random bytes in base64url: 43 characters, 256 bits.
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function generateJoinToken() {
  return randomBytes(32).toString("base64url");
}

/** The only lookup key. The raw token is never stored. */
export function hashJoinToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function isJoinToken(value: string) {
  return TOKEN_PATTERN.test(value);
}

/** The web page that opens the link; the token stays out of API paths. */
export function joinLinkUrl(token: string) {
  const base = (process.env.BATON_CLIENT_URL ?? "").replace(/\/+$/, "");
  return `${base}/join/${token}`;
}
