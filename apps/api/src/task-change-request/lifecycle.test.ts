import { describe, expect, it } from "vite-plus/test";
import { isPending, parseRequestState, transition } from "./lifecycle";

describe("change request lifecycle", () => {
  it("moves a pending request to the event's final state", () => {
    expect(transition("pending", { type: "accept" })).toEqual({
      kind: "move",
      to: "accepted",
    });
    expect(transition("pending", { type: "reject" })).toEqual({
      kind: "move",
      to: "rejected",
    });
    expect(transition("pending", { type: "cancel" })).toEqual({
      kind: "move",
      to: "cancelled",
    });
    expect(transition("pending", { type: "supersede" })).toEqual({
      kind: "move",
      to: "superseded",
    });
    expect(transition("pending", { type: "timeout", applies: true })).toEqual({
      kind: "move",
      to: "applied_on_timeout",
    });
    expect(transition("pending", { type: "timeout", applies: false })).toEqual({
      kind: "move",
      to: "expired",
    });
  });

  it("replays the same decision and refuses a different one", () => {
    expect(transition("accepted", { type: "accept" })).toEqual({
      kind: "replay",
      state: "accepted",
    });
    expect(transition("rejected", { type: "accept" })).toEqual({
      kind: "conflict",
      state: "rejected",
    });
    expect(transition("expired", { type: "reject" })).toEqual({
      kind: "conflict",
      state: "expired",
    });
  });

  it("treats an unknown state as final and never pending", () => {
    expect(parseRequestState("approved")).toBe("unknown");
    expect(isPending("approved")).toBe(false);
    expect(isPending("PENDING")).toBe(false);
    expect(transition("approved", { type: "accept" })).toEqual({
      kind: "conflict",
      state: "unknown",
    });
    expect(transition("", { type: "timeout", applies: true })).toEqual({
      kind: "conflict",
      state: "unknown",
    });
  });
});
