/**
 * Where a task sits in the queue, beyond its rank. A task with no entry is
 * ranked. Nothing here is saved: it lasts for one visit to the page.
 */
export type QueuePosition =
  | { kind: "pinned" }
  /** Pushed to the back. A higher turn was skipped later, so it sits further back. */
  | { kind: "skipped"; turn: number };

export type QueueOrder = {
  positions: Readonly<Record<string, QueuePosition>>;
  /** Counts skips, so skipped tasks keep the order they were skipped in. */
  turn: number;
};

export type QueueEvent =
  | { type: "pin"; id: string }
  | { type: "skip"; id: string }
  | { type: "release"; id: string };

export const INITIAL_QUEUE: QueueOrder = { positions: {}, turn: 0 };

function without(
  positions: QueueOrder["positions"],
  drop: (id: string, position: QueuePosition) => boolean,
) {
  return Object.fromEntries(
    Object.entries(positions).filter(([id, p]) => !drop(id, p)),
  );
}

/** The one place a queue position changes. An unknown event changes nothing. */
export function queueTransition(
  state: QueueOrder,
  event: QueueEvent,
): QueueOrder {
  switch (event.type) {
    case "pin":
      // One task is first at a time, so a new pin replaces the old one.
      return {
        ...state,
        positions: {
          ...without(state.positions, (_, p) => p.kind === "pinned"),
          [event.id]: { kind: "pinned" },
        },
      };
    case "skip":
      return {
        turn: state.turn + 1,
        positions: {
          ...state.positions,
          [event.id]: { kind: "skipped", turn: state.turn + 1 },
        },
      };
    case "release":
      return event.id in state.positions
        ? {
            ...state,
            positions: without(state.positions, (id) => id === event.id),
          }
        : state;
    default:
      return state;
  }
}

export function pinnedId(state: QueueOrder): string | null {
  const pinned = Object.entries(state.positions).find(
    ([, p]) => p.kind === "pinned",
  );
  return pinned?.[0] ?? null;
}

/** Ranked tasks in queue order: the pinned one, the ranked ones, then the skipped ones. */
export function orderQueue<T extends { id: string }>(
  ranked: readonly T[],
  state: QueueOrder,
): T[] {
  const at = (task: T) => state.positions[task.id];
  const skipped = ranked
    .flatMap((task) => {
      const position = at(task);
      return position?.kind === "skipped"
        ? [{ task, turn: position.turn }]
        : [];
    })
    .sort((a, b) => a.turn - b.turn)
    .map(({ task }) => task);
  return [
    ...ranked.filter((task) => at(task)?.kind === "pinned"),
    ...ranked.filter((task) => at(task) === undefined),
    ...skipped,
  ];
}
