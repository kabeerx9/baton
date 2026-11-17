/** A status a click asks for. `isFinal` is the column's flag: a final column completes the task. */
export type Target = { status: string; isFinal: boolean };

/**
 * What the server says an ordinary column move does for this caller
 * (`statusChange.move` on board items and task reads). Anything else is "request".
 */
export type Move = "apply" | "request" | "deny";

/**
 * One task's status write, from click to settled. No entry means idle.
 * An unknown `kind` is treated as idle: the server value shows.
 */
export type Entry =
  | { kind: "idle" }
  /** A request-only move waits for the modal. Nothing is sent. */
  | { kind: "confirming"; target: Target }
  /** The change request is in flight. The status does not move. */
  | { kind: "asking"; target: Target }
  /** At most one PUT in flight. `latest` is what the person last chose. */
  | { kind: "sending"; inFlight: Target; latest: Target }
  /** The PUT was applied. `target` shows until a read reaches `generation`. */
  | { kind: "confirmed"; target: Target; generation: number }
  /** The PUT may or may not have committed. Controls stay locked until a read after `since`. */
  | { kind: "uncertain"; since: number };

export type Event =
  | { type: "chosen"; target: Target; move: Move }
  | { type: "confirm" }
  | { type: "dismiss" }
  | { type: "applied"; generation: number | undefined }
  | { type: "requested" }
  /** The server answered with a 4xx: nothing was written. */
  | { type: "refused" }
  /** Network error, timeout or 5xx: the write may have committed. */
  | { type: "unknown"; at: number }
  /** A read of this task succeeded at time `at`. */
  | { type: "read"; at: number };

export type Step = {
  entry: Entry;
  /** The target to PUT now. Present on at most one step of a chain at a time. */
  send?: Target;
};

/** How a click ended. Only "applied" means the status changed. */
export type StatusOutcome = "applied" | "requested" | "superseded";
