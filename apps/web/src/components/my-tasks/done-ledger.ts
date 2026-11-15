import type { AssignedTask } from "@/fetchers/task/get-assigned-tasks";

/**
 * One task the person marked done on this visit, from the press to the point
 * where an undo is no longer possible. A task with no entry is untouched.
 *
 *   finishing --applied--> applied --synced (gone)--> finished
 *       |                     |                           |
 *   requested, failed       undo                        undo
 *       v                     v                           v
 *    (no entry)            undoing --undone--> (no entry)
 *                             |
 *                         undoFailed --> finished
 *
 * `applied` waits for the list: the server said yes, but the cached list may
 * still hold the task. If the next list still has it, the task is a feature
 * with open tasks under it, so the entry is dropped and the task shows again.
 */
export type DoneEntry = {
  task: AssignedTask;
  /** The status to write back on undo. */
  from: string;
} & (
  | { kind: "finishing" }
  | { kind: "applied"; at: number }
  | { kind: "finished" }
  | { kind: "undoing" }
);

/** Oldest first. A task has at most one entry. */
export type DoneLedger = readonly DoneEntry[];

export type DoneEvent =
  | { type: "start"; task: AssignedTask }
  /** `at` is the client time the write was confirmed. */
  | { type: "applied"; id: string; at: number }
  /** The write became a change request: the task did not change. */
  | { type: "requested"; id: string }
  | { type: "failed"; id: string }
  /** A list fetched at `updatedAt` holds these open task ids. */
  | { type: "synced"; openIds: ReadonlySet<string>; updatedAt: number }
  | { type: "undo"; id: string }
  | { type: "undone"; id: string }
  | { type: "undoFailed"; id: string };

export const EMPTY_LEDGER: DoneLedger = [];

function replace(
  ledger: DoneLedger,
  id: string,
  from: DoneEntry["kind"][],
  to: (entry: DoneEntry) => DoneEntry | null,
): DoneLedger {
  const entry = ledger.find((e) => e.task.id === id);
  if (!entry || !from.includes(entry.kind)) return ledger;
  const next = to(entry);
  return ledger.flatMap((e) => (e === entry ? (next ? [next] : []) : [e]));
}

const base = ({ task, from }: DoneEntry) => ({ task, from });

/**
 * True when a list updated at `updatedAt` was read after this entry's write.
 * The status mutation cancels every list fetch when the write is confirmed,
 * so a list updated at or after that moment cannot predate the write.
 */
function readAfterWrite(entry: DoneEntry, updatedAt: number): boolean {
  return entry.kind === "applied" && updatedAt >= entry.at;
}

/** The one place an entry changes. An event that does not fit the state changes nothing. */
export function doneTransition(
  ledger: DoneLedger,
  event: DoneEvent,
): DoneLedger {
  switch (event.type) {
    case "start":
      return ledger.some((e) => e.task.id === event.task.id)
        ? ledger
        : [
            ...ledger,
            { kind: "finishing", task: event.task, from: event.task.status },
          ];
    case "applied":
      return replace(ledger, event.id, ["finishing"], (e) => ({
        ...base(e),
        kind: "applied",
        at: event.at,
      }));
    case "requested":
    case "failed":
      return replace(ledger, event.id, ["finishing"], () => null);
    case "synced": {
      const settled = (e: DoneEntry) => readAfterWrite(e, event.updatedAt);
      if (!ledger.some(settled)) return ledger;
      return ledger.flatMap((e): DoneEntry[] => {
        if (!settled(e)) return [e];
        return event.openIds.has(e.task.id)
          ? []
          : [{ ...base(e), kind: "finished" }];
      });
    }
    case "undo":
      return replace(ledger, event.id, ["applied", "finished"], (e) => ({
        ...base(e),
        kind: "undoing",
      }));
    case "undone":
      return replace(ledger, event.id, ["undoing"], () => null);
    case "undoFailed":
      return replace(ledger, event.id, ["undoing"], (e) => ({
        ...base(e),
        kind: "finished",
      }));
    default:
      return ledger;
  }
}

/**
 * Tasks to leave out of the page although the cached list may still hold
 * them. A `finished` task is not here: the list already agrees, so if it comes
 * back later (someone reopened it) it shows.
 */
export function hiddenIds(ledger: DoneLedger): Set<string> {
  return new Set(
    ledger.filter((e) => e.kind !== "finished").map((e) => e.task.id),
  );
}

/**
 * Applied tasks that a list fetched at `updatedAt` still holds. The `synced`
 * event drops them; the caller reads this first to tell the person.
 */
export function stillOpen(
  ledger: DoneLedger,
  openIds: ReadonlySet<string>,
  updatedAt: number,
): AssignedTask[] {
  return ledger
    .filter((e) => readAfterWrite(e, updatedAt) && openIds.has(e.task.id))
    .map((e) => e.task);
}

/** The newest task an undo can reopen, or null when the window is closed. */
export function undoTarget(ledger: DoneLedger): DoneEntry | null {
  return (
    ledger
      .filter((e) => e.kind === "applied" || e.kind === "finished")
      .at(-1) ?? null
  );
}

/** How many tasks the person cleared on this visit and has not reopened. */
export function clearedCount(ledger: DoneLedger): number {
  return ledger.filter((e) => e.kind === "applied" || e.kind === "finished")
    .length;
}
