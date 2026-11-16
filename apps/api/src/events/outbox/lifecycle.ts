// The lifecycle of one outbox row: one delivery of one event to one
// consumer. Pure: the relay reads a row into a `Delivery`, runs the
// handler, and applies whatever `transition` returns with a fenced write.

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
  | { state: "pending"; attempts: number; createdAt: Date }
  | { state: "dead"; reason: DeadReason };

export type Outcome =
  | { kind: "delivered" }
  | { kind: "dropped"; reason: string }
  | { kind: "failed"; error: string }
  | { kind: "expired" }
  | { kind: "unknown" };

export type Step =
  | { op: "delete" }
  | { op: "retry"; delayMs: number }
  | { op: "dead"; reason: DeadReason };

/** Any stored state other than `pending` is dead: never claimed, never run. */
export function readDelivery(row: {
  state: string;
  attempts: number;
  createdAt: Date;
}): Delivery {
  if (row.state === "pending")
    return {
      state: "pending",
      attempts: row.attempts,
      createdAt: row.createdAt,
    };
  return { state: "dead", reason: "unknown_state" };
}

/**
 * `attempts` counts claims, so it already includes the attempt that just
 * ran. `random` returns a number in [0, 1) and spreads retries by ±20%.
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
        : { op: "retry", delayMs: UNKNOWN_RETRY_MS };
    case "failed": {
      if (delivery.attempts >= MAX_ATTEMPTS)
        return { op: "dead", reason: "max_attempts" };
      const base: number =
        RETRY_DELAYS_MS[
          Math.min(
            Math.max(0, delivery.attempts - 1),
            RETRY_DELAYS_MS.length - 1,
          )
        ] ?? RETRY_DELAYS_MS[0];
      const spread = 1 + JITTER * (2 * random() - 1);
      return { op: "retry", delayMs: Math.round(base * spread) };
    }
    default:
      // A new outcome kind that this code does not know is the safe case.
      return { op: "dead", reason: "unknown_state" };
  }
}
