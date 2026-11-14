import { subDays } from "date-fns";

/** The Done column shows work finished in this many days. */
export const DONE_WINDOW_DAYS = 14;

/**
 * Splits finished items into those shown on the board and a count of older
 * ones that live on the History page. A done item always has a finish time in
 * practice; one without it stays on the board, so nothing vanishes unseen.
 */
export function splitDone<T extends { finishedAt: string | null }>(
  items: T[],
  now: Date = new Date(),
): { recent: T[]; olderCount: number } {
  const cutoff = subDays(now, DONE_WINDOW_DAYS).getTime();
  const recent = items.filter(
    (item) => !item.finishedAt || new Date(item.finishedAt).getTime() >= cutoff,
  );
  return { recent, olderCount: items.length - recent.length };
}
