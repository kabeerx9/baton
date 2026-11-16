import { describe, expect, it } from "vite-plus/test";
import {
  MAX_ATTEMPTS,
  RETRY_DELAYS_MS,
  UNKNOWN_DEAD_AFTER_MS,
  UNKNOWN_RETRY_MS,
  readDelivery,
  transition,
  type Delivery,
  type Outcome,
} from "../../../apps/api/src/events/outbox/lifecycle";

const now = new Date("2026-11-16T12:00:00.000Z");
const created = new Date("2026-11-16T11:59:00.000Z");
const mid = () => 0.5;
const pending = (attempts: number, createdAt = created): Delivery => ({
  state: "pending",
  attempts,
  createdAt,
});

describe("readDelivery", () => {
  it("reads pending rows as pending", () => {
    expect(
      readDelivery({ state: "pending", attempts: 2, createdAt: created }),
    ).toEqual(pending(2));
  });

  it.each(["dead", "delivered", "", "PENDING"])(
    "reads stored state %j as dead",
    (state) => {
      expect(readDelivery({ state, attempts: 0, createdAt: created })).toEqual({
        state: "dead",
        reason: "unknown_state",
      });
    },
  );
});

describe("transition", () => {
  it.each<Outcome>([
    { kind: "delivered" },
    { kind: "dropped", reason: "task_gone" },
  ])("deletes the row on %j", (outcome) => {
    expect(transition(pending(1), outcome, now, mid)).toEqual({
      op: "delete",
    });
  });

  it.each(RETRY_DELAYS_MS.map((delay, index) => [index + 1, delay] as const))(
    "retries failure %i after %i ms",
    (attempts, delay) => {
      expect(
        transition(pending(attempts), { kind: "failed", error: "E" }, now, mid),
      ).toEqual({ op: "retry", delayMs: delay });
    },
  );

  it("spreads a retry by at most 20%", () => {
    const low = transition(
      pending(1),
      { kind: "failed", error: "E" },
      now,
      () => 0,
    );
    const high = transition(
      pending(1),
      { kind: "failed", error: "E" },
      now,
      () => 0.999999,
    );
    expect(low).toEqual({ op: "retry", delayMs: 4_000 });
    expect(high).toEqual({ op: "retry", delayMs: 6_000 });
  });

  it("makes the sixth failure dead", () => {
    expect(
      transition(
        pending(MAX_ATTEMPTS),
        { kind: "failed", error: "E" },
        now,
        mid,
      ),
    ).toEqual({ op: "dead", reason: "max_attempts" });
  });

  it("makes a failure after an interrupted final attempt dead", () => {
    expect(
      transition(
        pending(MAX_ATTEMPTS + 1),
        { kind: "failed", error: "interrupted" },
        now,
        mid,
      ),
    ).toEqual({ op: "dead", reason: "max_attempts" });
  });

  it("retries an unknown payload after one minute", () => {
    expect(transition(pending(30), { kind: "unknown" }, now, mid)).toEqual({
      op: "retry",
      delayMs: UNKNOWN_RETRY_MS,
    });
  });

  it("makes an unknown payload dead after 24 hours", () => {
    const old = new Date(now.getTime() - UNKNOWN_DEAD_AFTER_MS);
    expect(transition(pending(3, old), { kind: "unknown" }, now, mid)).toEqual({
      op: "dead",
      reason: "unknown_payload",
    });
  });

  it("makes an expired delivery dead", () => {
    expect(transition(pending(1), { kind: "expired" }, now, mid)).toEqual({
      op: "dead",
      reason: "expired",
    });
  });

  it.each<Outcome>([
    { kind: "delivered" },
    { kind: "failed", error: "E" },
    { kind: "unknown" },
  ])("keeps a dead delivery dead on %j", (outcome) => {
    expect(
      transition({ state: "dead", reason: "expired" }, outcome, now, mid),
    ).toEqual({ op: "dead", reason: "expired" });
  });

  it("treats an outcome kind it does not know as dead", () => {
    expect(
      transition(pending(1), { kind: "later" } as unknown as Outcome, now, mid),
    ).toEqual({ op: "dead", reason: "unknown_state" });
  });
});
