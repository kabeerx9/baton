import { startOfDay, subDays } from "date-fns";

/** The Done column shows work finished in this many days. The server keeps its own copy. */
export const DONE_WINDOW_DAYS = 14;

/**
 * The oldest finish time the board asks for: local midnight, so the window
 * counts calendar days, minus the window. The server has no time zone.
 */
export function doneSince(now: Date = new Date()): string {
  return subDays(startOfDay(now), DONE_WINDOW_DAYS).toISOString();
}
