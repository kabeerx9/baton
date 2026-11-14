/**
 * The lifecycle of a task change request. One state, one pure transition.
 *
 *   pending -> accepted | rejected | cancelled | superseded | expired | applied_on_timeout
 *
 * Every state except pending is final. A stored value this module does not
 * know is treated as final too, so nothing ever applies from it.
 */
export const REQUEST_STATES = [
  "pending",
  "accepted",
  "rejected",
  "cancelled",
  "superseded",
  "expired",
  "applied_on_timeout",
] as const;

export type RequestState = (typeof REQUEST_STATES)[number];
export type FinalState = Exclude<RequestState, "pending">;
export type KnownOrUnknownState = RequestState | "unknown";

export type RequestEvent =
  /** An involved person or bypass role accepted; the change applies. */
  | { type: "accept" }
  | { type: "reject" }
  /** The requester withdrew it, or the task changed under it. */
  | { type: "cancel" }
  /** A newer request on the same task replaced it. */
  | { type: "supersede" }
  /** The 24 hour deadline passed. `applies` is false for final or delete targets. */
  | { type: "timeout"; applies: boolean };

export type Transition =
  | { kind: "move"; to: FinalState }
  /** The same decision is already recorded: answer it again, change nothing. */
  | { kind: "replay"; state: FinalState }
  /** The request is no longer pending and a different outcome is recorded. */
  | { kind: "conflict"; state: KnownOrUnknownState };

export function parseRequestState(raw: string): KnownOrUnknownState {
  return (REQUEST_STATES as readonly string[]).includes(raw)
    ? (raw as RequestState)
    : "unknown";
}

export function isPending(raw: string) {
  return parseRequestState(raw) === "pending";
}

function target(event: RequestEvent): FinalState {
  switch (event.type) {
    case "accept":
      return "accepted";
    case "reject":
      return "rejected";
    case "cancel":
      return "cancelled";
    case "supersede":
      return "superseded";
    case "timeout":
      return event.applies ? "applied_on_timeout" : "expired";
  }
}

export function transition(raw: string, event: RequestEvent): Transition {
  const state = parseRequestState(raw);
  const to = target(event);
  if (state === "pending") return { kind: "move", to };
  if (state !== "unknown" && state === to) return { kind: "replay", state };
  return { kind: "conflict", state };
}
