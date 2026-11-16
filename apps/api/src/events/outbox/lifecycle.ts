// The lifecycle of one outbox row: one delivery of one event to one
// consumer. Pure: the relay reads a row into a `Delivery`, asks
// `preflight` whether to run it, runs the handler, and applies whatever
// `transition` returns with a fenced write.
//
// `attempts` counts claims and is the fence, so it only grows. The
// failure budget is `attempts - exempt_claims`: claims that ended as
// `unknown` (a payload this version cannot read) and claims forgiven by a
// requeue are exempt, so they never make a row dead early.

export const MAX_ATTEMPTS = 6;
/** Waits after failures 1 to 5; the sixth failure is final. */
export const RETRY_DELAYS_MS = [
  5_000,
  30_000,
  2 * 60_000,
  10 * 60_000,
  60 * 60_000,
] as const;
export const UNKNOWN_RETRY_MS = 60_000;
export const UNKNOWN_DEAD_AFTER_MS = 24 * 60 * 60_000;
const JITTER = 0.2;

export type DeadReason =
  | "max_attempts"
  | "unknown_payload"
  | "expired"
  | "unknown_state";

export type Delivery =
  | { state: "pending"; spent: number; createdAt: Date }
  | { state: "dead"; reason: DeadReason };

export type Outcome =
  | { kind: "delivered" }
  | { kind: "dropped"; reason: string }
  | { kind: "failed"; error: string }
  | { kind: "expired" }
  | { kind: "unknown" };

export type Step =
  | { op: "delete" }
  /** `exempt`: this claim does not count against the failure budget. */
  | { op: "retry"; delayMs: number; exempt: boolean }
  | { op: "dead"; reason: DeadReason };

/** Any stored state other than `pending` is dead: never claimed, never run. */
export function readDelivery(row: {
  state: string;
  attempts: number;
  exemptClaims: number;
  createdAt: Date;
}): Delivery {
  if (row.state === "pending")
    return {
      state: "pending",
      spent: Math.max(0, row.attempts - row.exemptClaims),
      createdAt: row.createdAt,
    };
  return { state: "dead", reason: "unknown_state" };
}

/**
 * Decides a claimed row's outcome before its handler runs, or returns
 * null to run it. An unreadable payload is `unknown` whatever the budget.
 * A spent budget above the maximum means a crash after the final claim.
 */
export function preflight(
  delivery: Delivery,
  payloadReadable: boolean,
): Outcome | null {
  if (delivery.state === "dead") return { kind: "unknown" };
  if (!payloadReadable) return { kind: "unknown" };
  if (delivery.spent > MAX_ATTEMPTS)
    return { kind: "failed", error: "interrupted" };
  return null;
}

/**
 * `spent` already includes the claim that just ran. `random` returns a number in [0, 1) and spreads retries by ±20%.
 * A retry carries a delay, not a time: the relay adds it to the database
 * clock, so the lease and the retry share one clock.
 */
export function transition(
  delivery: Delivery,
  outcome: Outcome,
  now: Date,
  random: () => number,
): Step {
  if (delivery.state === "dead") return { op: "dead", reason: delivery.reason };
  switch (outcome.kind) {
    case "delivered":
    case "dropped":
      return { op: "delete" };
    case "expired":
      return { op: "dead", reason: "expired" };
    case "unknown":
      return now.getTime() - delivery.createdAt.getTime() >=
        UNKNOWN_DEAD_AFTER_MS
        ? { op: "dead", reason: "unknown_payload" }
        : { op: "retry", delayMs: UNKNOWN_RETRY_MS, exempt: true };
    case "failed": {
      if (delivery.spent >= MAX_ATTEMPTS)
        return { op: "dead", reason: "max_attempts" };
      const base: number =
        RETRY_DELAYS_MS[
          Math.min(Math.max(0, delivery.spent - 1), RETRY_DELAYS_MS.length - 1)
        ] ?? RETRY_DELAYS_MS[0];
      const spread = 1 + JITTER * (2 * random() - 1);
      return {
        op: "retry",
        delayMs: Math.round(base * spread),
        exempt: false,
      };
    }
    default:
      // A new outcome kind that this code does not know is the safe case.
      return { op: "dead", reason: "unknown_state" };
  }
}
