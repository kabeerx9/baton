const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export const STALE_AFTER_DAYS = 60;

/** "just now", "5 min ago", "3 hours ago", "yesterday", "12 days ago". */
export function formatAgo(iso: string, now: number): string {
  const diff = now - new Date(iso).getTime();
  if (!Number.isFinite(diff) || diff < MINUTE) return "just now";
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)} min ago`;
  if (diff < DAY) {
    const hours = Math.floor(diff / HOUR);
    return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  }
  const days = Math.floor(diff / DAY);
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

/** A grant never used, or not used for 60 days, is stale. */
export function isStale(
  lastUsedAt: string | null,
  createdAt: string,
  now: number,
): boolean {
  const basis = new Date(lastUsedAt ?? createdAt).getTime();
  return Number.isFinite(basis) && now - basis >= STALE_AFTER_DAYS * DAY;
}
