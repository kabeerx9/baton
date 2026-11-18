import { describe, expect, it } from "vite-plus/test";
import { decideTour, toTourState } from "./lifecycle";

const pending = toTourState(null);
const completed = toTourState(new Date("2026-11-01T00:00:00Z"));

describe("decideTour", () => {
  it("reads a null completion time as pending", () => {
    expect(pending).toEqual({ kind: "pending" });
    expect(completed.kind).toBe("completed");
  });

  it("seeds a demo when a pending tour has none", () => {
    expect(decideTour(pending, "start", "none")).toEqual({ kind: "seed_demo" });
  });

  it("resumes an intact demo, so a reload keeps the same tour", () => {
    expect(decideTour(pending, "start", "intact")).toEqual({
      kind: "resume_demo",
    });
  });

  it("replaces a demo that lost a tour task", () => {
    expect(decideTour(pending, "start", "broken")).toEqual({
      kind: "reset_demo",
    });
  });

  it("refuses to start a completed tour", () => {
    for (const demo of ["none", "intact", "broken"] as const) {
      expect(decideTour(completed, "start", demo)).toEqual({
        kind: "refuse_completed",
      });
    }
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
