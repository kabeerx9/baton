import { describe, expect, it } from "vite-plus/test";
import { decideTour, toTourState } from "./lifecycle";

const pending = toTourState(null);
const completed = toTourState(new Date("2026-11-01T00:00:00Z"));

describe("decideTour", () => {
  it("reads a null completion time as pending", () => {
    expect(pending).toEqual({ kind: "pending" });
    expect(completed.kind).toBe("completed");
  });

  it("starts a pending tour by resetting the demo workspace", () => {
    expect(decideTour(pending, "start")).toEqual({ kind: "reset_demo" });
  });

  it("refuses to start a completed tour", () => {
    expect(decideTour(completed, "start")).toEqual({
      kind: "refuse_completed",
    });
  });

  it("finishes once, then only cleans up", () => {
    expect(decideTour(pending, "finish")).toEqual({ kind: "complete" });
    expect(decideTour(completed, "finish")).toEqual({ kind: "clean_up" });
  });

  it("reopens from either state", () => {
    expect(decideTour(pending, "replay")).toEqual({ kind: "reopen" });
    expect(decideTour(completed, "replay")).toEqual({ kind: "reopen" });
  });
});
