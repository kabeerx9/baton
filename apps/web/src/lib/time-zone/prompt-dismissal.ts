// Convenience only: the page works without storage. Every access is guarded
// because storage can be missing, full or blocked.
const key = (userId: string) => `baton:time-zone-prompt:${userId}`;

type Scope = "browser" | "session";

function store(scope: Scope): Storage | null {
  try {
    return scope === "browser" ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

/** The device zone the person last dismissed the prompt for, or null. */
export function readDismissed(userId: string): string | null {
  for (const scope of ["browser", "session"] as const) {
    try {
      const value = store(scope)?.getItem(key(userId));
      if (value) return value;
    } catch {
      // Treat unreadable storage as "never dismissed".
    }
  }
  return null;
}

/** "browser" outlives the tab; "session" returns on the next visit. */
export function writeDismissed(
  userId: string,
  detected: string,
  scope: Scope,
): void {
  try {
    store(scope)?.setItem(key(userId), detected);
  } catch {
    // The prompt may return on the next page load. That is acceptable.
  }
}
