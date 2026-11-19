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

const JOIN_PATH_PATTERN = /^\/join\/([^/]+)\/?$/;

function parseUrl(text: string): URL | null {
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(text)
    ? text
    : `https://${text.replace(/^\/+/, "")}`;
  try {
    return new URL(withScheme);
  } catch {
    return null;
  }
}

/**
 * Reads the token out of what a person pastes: the token with spaces around
 * it, a join URL (`/join/<token>` or `?t=<token>`), or a bare `/join/<token>`
 * path. The host is not checked; the hash lookup decides. Null otherwise.
 */
export function parseJoinToken(input: string): string | null {
  const text = input.trim();
  if (isJoinToken(text)) return text;
  if (!text || /\s/.test(text)) return null;
  const url = text.startsWith("/")
    ? new URL(text, "https://baton.invalid")
    : parseUrl(text);
  if (!url) return null;
  const fromPath = JOIN_PATH_PATTERN.exec(url.pathname)?.[1];
  const token = fromPath ?? url.searchParams.get("t");
  return token && isJoinToken(token) ? token : null;
}

/** The web page that opens the link; the token stays out of API paths. */
export function joinLinkUrl(token: string) {
  const base = (process.env.BATON_CLIENT_URL ?? "").replace(/\/+$/, "");
  return `${base}/join/${token}`;
}
