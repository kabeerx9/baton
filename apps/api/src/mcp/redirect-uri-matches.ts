const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

function loopback(value: string): URL | null {
  try {
    const url = new URL(value);
    return url.protocol === "http:" && LOOPBACK_HOSTS.has(url.hostname)
      ? url
      : null;
  } catch {
    return null;
  }
}

/**
 * Exact match, except that a loopback http redirect may use any port
 * (RFC 8252 section 7.3): native clients pick a free port on each sign-in.
 */
export function redirectUriMatches(
  registered: string,
  requested: string,
): boolean {
  if (registered === requested) return true;
  const a = loopback(registered);
  const b = loopback(requested);
  if (!a || !b) return false;
  return (
    a.hostname === b.hostname &&
    a.pathname === b.pathname &&
    a.search === b.search
  );
}
