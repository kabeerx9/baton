import { describe, expect, it } from "vite-plus/test";
import {
  changeTimesMs,
  deriveLoadView,
  endsAtMs,
  HANDOFF_MS,
  MIN_SHOWN_MS,
  SHOW_AFTER_MS,
} from "./load-view";
import { scenarioById } from "./scenarios";

const fast = scenarioById("fast");
const justOver = scenarioById("just-over");
const normal = scenarioById("normal");
const slow = scenarioById("slow");
const error = scenarioById("error");

describe("deriveLoadView", () => {
  it("shows nothing for a load that ends before the delay", () => {
    for (const t of [0, 100, 149]) {
      expect(deriveLoadView(fast, t)).toEqual({ kind: "quiet" });
    }
    expect(deriveLoadView(fast, 150)).toEqual({
      kind: "handoff",
      wasShown: false,
    });
    expect(deriveLoadView(fast, 150 + HANDOFF_MS)).toEqual({ kind: "done" });
  });

  it("holds the loading UI for the minimum time once shown", () => {
    expect(endsAtMs(justOver)).toBe(SHOW_AFTER_MS + MIN_SHOWN_MS);
    expect(deriveLoadView(justOver, 399).kind).toBe("loading");
    expect(deriveLoadView(justOver, 799).kind).toBe("loading");
    expect(deriveLoadView(justOver, 800)).toEqual({
      kind: "handoff",
      wasShown: true,
    });
  });

  it("does not stretch a load that already outlasts the minimum", () => {
    expect(endsAtMs(normal)).toBe(1200);
    expect(deriveLoadView(normal, 299).kind).toBe("quiet");
    expect(deriveLoadView(normal, 300).kind).toBe("loading");
  });

  it("walks the real steps in order and adds the reassuring line at 3s", () => {
    expect(deriveLoadView(slow, 300)).toMatchObject({
      step: 0,
      reassure: false,
    });
    expect(deriveLoadView(slow, 800)).toMatchObject({ step: 1 });
    expect(deriveLoadView(slow, 1300)).toMatchObject({ step: 2 });
    expect(deriveLoadView(slow, 2999)).toMatchObject({ reassure: false });
    expect(deriveLoadView(slow, 3000)).toMatchObject({
      step: 2,
      reassure: true,
    });
    expect(deriveLoadView(slow, 5000).kind).toBe("handoff");
  });

  it("ends in failed, and stays failed", () => {
    expect(deriveLoadView(error, 1199).kind).toBe("loading");
    expect(deriveLoadView(error, 1200)).toEqual({ kind: "failed" });
    expect(deriveLoadView(error, 60_000)).toEqual({ kind: "failed" });
  });

  it("treats an unknown clock as quiet", () => {
    expect(deriveLoadView(normal, Number.NaN)).toEqual({ kind: "quiet" });
    expect(deriveLoadView(normal, -5)).toEqual({ kind: "quiet" });
  });
});

describe("changeTimesMs", () => {
  it("lists each moment the view can change, in order", () => {
    expect(changeTimesMs(slow)).toEqual([300, 800, 1300, 3000, 5000, 5240]);
    expect(changeTimesMs(fast)).toEqual([150, 390]);
    expect(changeTimesMs(error)).toEqual([300, 800, 1200]);
  });

  it("agrees with the derive function at every change time", () => {
    for (const scenario of [fast, justOver, normal, slow, error]) {
      const times = changeTimesMs(scenario);
      for (const t of times) {
        const before = deriveLoadView(scenario, t - 1);
        const after = deriveLoadView(scenario, t);
        expect(after).not.toEqual(before);
      }
    }
  });
});
