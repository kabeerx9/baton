const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const JOIN_PATH_PATTERN = /^\/join\/([^/]+)\/?$/;

export const JOIN_INTENT_STORAGE_KEY = "baton:join-intent";

export function isJoinToken(value: string): boolean {
  return TOKEN_PATTERN.test(value);
}

function parseUrl(input: string): URL | null {
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(input)
    ? input
    : `https://${input.replace(/^\/+/, "")}`;
  try {
    return new URL(withScheme);
  } catch {
    return null;
  }
}

/**
 * Reads a join token from what a person pastes: a raw token, a full join URL,
 * or a bare `/join/<token>` path. Returns null for anything else. The host is
 * not checked: the server decides whether the token is real.
 */
export function parseJoinToken(input: string): string | null {
  const text = input.trim();
  if (!text) return null;
  if (isJoinToken(text)) return text;

  const url = text.startsWith("/join/")
    ? new URL(text, "https://baton.invalid")
    : parseUrl(text);
  if (!url) return null;
  const match = JOIN_PATH_PATTERN.exec(url.pathname);
  const token = match?.[1];
  return token && isJoinToken(token) ? token : null;
}

function storage(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/** Remember which link a visitor left to sign up, so it joins on return. */
export function rememberJoinIntent(token: string): void {
  try {
    storage()?.setItem(JOIN_INTENT_STORAGE_KEY, token);
  } catch {
    // Storage can be blocked. The return then shows the one-click button.
  }
}

export function hasJoinIntent(token: string): boolean {
  try {
    return storage()?.getItem(JOIN_INTENT_STORAGE_KEY) === token;
  } catch {
    return false;
  }
}

export function clearJoinIntent(): void {
  try {
    storage()?.removeItem(JOIN_INTENT_STORAGE_KEY);
  } catch {
    // Nothing to clear.
  }
}
