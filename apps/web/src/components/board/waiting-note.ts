import { type Blockable, isBlocked } from "./model";

export type WaitingNote = {
  /** "KEY · Name" for each blocker you can see. */
  visible: string[];
  hidden: number;
};

/** What a card says about being held up, or null when it is free. */
export function waitingNote(item: Blockable): WaitingNote | null {
  if (!isBlocked(item)) return null;
  return {
    visible: item.waitsOn.map((b) =>
      b.assigneeName ? `${b.key} · ${b.assigneeName}` : b.key,
    ),
    hidden: item.hiddenBlockers,
  };
}
