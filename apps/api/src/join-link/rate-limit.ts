// In-process fixed-window limits for the join-link routes. Per instance and
// reset on restart: the 256-bit token is the control, these only bound load.
// Production runs one instance, and nothing here needs Redis.

const MAX_KEYS = 10_000;

export type RateLimitDecision =
  | { kind: "allowed" }
  | { kind: "limited"; retryAfterSeconds: number };

export function createFixedWindowLimiter({
  limit,
  windowMs,
}: {
  limit: number;
  windowMs: number;
}) {
  const windows = new Map<string, { startedAt: number; count: number }>();

  return {
    hit(key: string, now = Date.now()): RateLimitDecision {
      const current = windows.get(key);
      if (!current || now - current.startedAt >= windowMs) {
        // Bounded so a flood of distinct keys cannot grow the map forever.
        if (!current && windows.size >= MAX_KEYS) windows.clear();
        windows.set(key, { startedAt: now, count: 1 });
        return { kind: "allowed" };
      }
      if (current.count >= limit) {
        const retryAfterMs = current.startedAt + windowMs - now;
        return {
          kind: "limited",
          retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
        };
      }
      current.count += 1;
      return { kind: "allowed" };
    },
    reset() {
      windows.clear();
    },
    size() {
      return windows.size;
    },
  };
}

/** Public preview: 30 per minute per client IP; no IP shares one bucket. */
export const previewLimiter = createFixedWindowLimiter({
  limit: 30,
  windowMs: 60_000,
});

/** Join: 10 per minute per user. */
export const joinLimiter = createFixedWindowLimiter({
  limit: 10,
  windowMs: 60_000,
});

export function resetJoinLinkRateLimits() {
  previewLimiter.reset();
  joinLimiter.reset();
}
