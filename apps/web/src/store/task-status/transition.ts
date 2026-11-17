import type { Entry, Event, Move, Step, Target } from "./types";

export const IDLE: Entry = { kind: "idle" };

const sameTarget = (a: Target, b: Target) =>
  a.status === b.status && a.isFinal === b.isFinal;

/** Any value but "apply" and "deny" is "request": the safe move for an unknown answer. */
export function moveOf(statusChange: unknown): Move {
  const move = (statusChange as { move?: unknown } | null | undefined)?.move;
  return move === "apply" || move === "deny" ? move : "request";
}

/**
 * The only place an entry changes. Pure: the caller runs `send` and reports
 * what came back as the next event. An event that does not fit the entry
 * leaves it as it is.
 */
export function transition(entry: Entry, event: Event): Step {
  switch (event.type) {
    case "chosen":
      return chosen(entry, event.target, event.move);
    case "confirm":
      return entry.kind === "confirming"
        ? {
            entry: { kind: "asking", target: entry.target },
            send: entry.target,
          }
        : { entry };
    case "dismiss":
      return entry.kind === "confirming" ? { entry: IDLE } : { entry };
    case "applied":
      return applied(entry, event.generation);
    case "requested":
      // A request ends the chain; a queued newer target is never sent.
      return entry.kind === "sending" || entry.kind === "asking"
        ? { entry: IDLE }
        : { entry };
    case "refused":
      return refused(entry);
    case "unknown":
      return entry.kind === "sending" || entry.kind === "asking"
        ? { entry: { kind: "uncertain", since: event.at } }
        : { entry };
    case "read":
      return entry.kind === "uncertain" && event.at >= entry.since
        ? { entry: IDLE }
        : { entry };
    default:
      return { entry };
  }
}

function chosen(entry: Entry, target: Target, move: Move): Step {
  switch (entry.kind) {
    case "sending":
      // Latest wins. Nothing is sent: the in-flight PUT sends it when it ends.
      return move === "apply"
        ? { entry: { ...entry, latest: target } }
        : { entry };
    case "confirming":
    case "asking":
    case "uncertain":
      // One modal, one request, no queue; a locked task takes no click.
      return { entry };
    default:
      // idle, confirmed, or an unknown kind: start a new chain.
      if (move === "apply") {
        return {
          entry: { kind: "sending", inFlight: target, latest: target },
          send: target,
        };
      }
      return move === "request"
        ? { entry: { kind: "confirming", target } }
        : { entry };
  }
}

function applied(entry: Entry, generation: number | undefined): Step {
  if (entry.kind === "sending") {
    if (!sameTarget(entry.latest, entry.inFlight)) {
      return {
        entry: {
          kind: "sending",
          inFlight: entry.latest,
          latest: entry.latest,
        },
        send: entry.latest,
      };
    }
    return { entry: confirmed(entry.inFlight, generation) };
  }
  // We asked, but the server applied it: the facts changed under us.
  if (entry.kind === "asking") {
    return { entry: confirmed(entry.target, generation) };
  }
  return { entry };
}

/** Without a generation there is nothing to compare: the server value wins at once. */
function confirmed(target: Target, generation: number | undefined): Entry {
  return typeof generation === "number" && Number.isFinite(generation)
    ? { kind: "confirmed", target, generation }
    : IDLE;
}

function refused(entry: Entry): Step {
  if (entry.kind === "sending") {
    return sameTarget(entry.latest, entry.inFlight)
      ? { entry: IDLE }
      : {
          entry: {
            kind: "sending",
            inFlight: entry.latest,
            latest: entry.latest,
          },
          send: entry.latest,
        };
  }
  return entry.kind === "asking" ? { entry: IDLE } : { entry };
}

/**
 * Archive and unarchive keep their old, non-optimistic path (R1.1): the
 * server's rule for them differs from an ordinary column move.
 */
function isArchiveMove(server: ServerStatus, target: Target) {
  return server.status === "archived" || target.status === "archived";
}

/** What a task read says about its status. `statusGeneration` may be missing on old payloads. */
export type ServerStatus = {
  status: string;
  statusGeneration?: number | null;
};

/**
 * The target a view shows instead of the server value, or null for the server
 * value. The one place that reads an entry for display.
 */
export function overlayTarget(
  server: ServerStatus,
  entry: Entry | undefined,
): Target | null {
  if (!entry) return null;
  switch (entry.kind) {
    case "sending":
      return isArchiveMove(server, entry.latest) ? null : entry.latest;
    case "confirmed": {
      const seen = server.statusGeneration;
      // No generation on the read: the server wins.
      return typeof seen === "number" &&
        seen < entry.generation &&
        !isArchiveMove(server, entry.target)
        ? entry.target
        : null;
    }
    default:
      return null;
  }
}

export function shownStatus(
  server: ServerStatus,
  entry: Entry | undefined,
): string {
  return overlayTarget(server, entry)?.status ?? server.status;
}

/** Controls stay locked while a modal, a request or an unresolved write holds the task. */
export function isStatusLocked(entry: Entry | undefined): boolean {
  return (
    entry?.kind === "confirming" ||
    entry?.kind === "asking" ||
    entry?.kind === "uncertain"
  );
}
