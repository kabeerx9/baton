import { type Blockable, isBlocked } from "@/components/board/model";

export type BlockedBadge = {
  /** The first visible blocker, if any. */
  firstKey: string | null;
  /** Blockers beyond the first one shown: the rest, plus hidden ones. */
  more: number;
  hidden: number;
  /** Every visible blocker as "KEY title", for the tooltip. */
  titles: string[];
};

/** What a My tasks row says about being blocked, or null when it is free. */
export function blockedBadge(task: Blockable): BlockedBadge | null {
  if (!isBlocked(task)) return null;
  const total = task.waitsOn.length + task.hiddenBlockers;
  const first = task.waitsOn[0];
  return {
    firstKey: first?.key ?? null,
    more: first ? total - 1 : 0,
    hidden: task.hiddenBlockers,
    titles: task.waitsOn.map((b) => `${b.key} ${b.title}`),
  };
}
