import type { FocusRecovered } from "./board-nav";

/** What the board says when focus moved without a key press. */
export type Say = (key: string, values?: Record<string, string>) => string;

/** The words for a screen reader, or null when there is nothing to say. */
export function recoveryText(details: FocusRecovered, say: Say): string | null {
  if (details.reason === "moved") {
    if (!details.column) return null;
    return say("workspace:board.nav.moved", {
      key: details.label,
      column: say(`workspace:board.columns.${details.column}`),
    });
  }
  return say("workspace:board.nav.removed", { key: details.label });
}
