/** The board's Done column shows work finished in this many days. */
export const DONE_WINDOW_DAYS = 14;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The cutoff for done work on the board. The server has no time zone, so the
 * web sends its local midnight; without one the default is now minus the
 * window. A future value is clamped to now. The query schema rejects text that
 * is not a datetime before this runs.
 */
export function resolveDoneSince(param: string | undefined, now = new Date()) {
  if (param === undefined)
    return new Date(now.getTime() - DONE_WINDOW_DAYS * DAY_MS);
  const parsed = new Date(param);
  return parsed.getTime() > now.getTime() ? now : parsed;
}
