import { useLocalDay } from "@/hooks/use-local-day";
import { useRefetchOnNewDay } from "./use-refetch-on-new-day";

/**
 * Keeps the board's Done cutoff current. Mounted once by the app layout, not
 * by the board page: the query client does not refetch on mount, so a tab
 * that crosses midnight on another page would otherwise open the board with
 * yesterday's window.
 */
export function BoardDayRollover() {
  useRefetchOnNewDay(useLocalDay());
  return null;
}
