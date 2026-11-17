import type { StatusOutcome } from "./types";

export type Waiter = {
  resolve: (outcome: StatusOutcome) => void;
  reject: (error: unknown) => void;
};

/**
 * The callers waiting on a task's chain. `current` wait on the PUT in flight
 * (or on the modal); `queued` wait on the newer target held back behind it.
 * This holds promises, not state: the lifecycle is the store entry.
 */
export type Waiters = { current: Waiter[]; queued: Waiter[] };

export const waiters = new Map<string, Waiters>();
