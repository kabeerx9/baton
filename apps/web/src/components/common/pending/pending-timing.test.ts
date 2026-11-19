import { describe, expect, it } from "vite-plus/test";
import {
  derivePending,
  IDLE_PENDING,
  MIN_SHOWN_MS,
  nextPendingTimes,
  SHOW_AFTER_MS,
} from "./pending-timing";

const run = (events: ["start" | "end", number][]) =>
  events.reduce(
    (times, [type, now]) => nextPendingTimes(times, { type, now }),
    IDLE_PENDING,
  );

describe("derivePending", () => {
  it("shows nothing when idle", () => {
    expect(derivePending(IDLE_PENDING, 1000)).toEqual({
      visible: false,
      recheckInMs: null,
    });
  });

  it("waits for the delay, then shows while the wait goes on", () => {
    const times = run([["start", 0]]);
    expect(derivePending(times, 100)).toEqual({
      visible: false,
      recheckInMs: SHOW_AFTER_MS - 100,
    });
    expect(derivePending(times, SHOW_AFTER_MS)).toEqual({
      visible: true,
      recheckInMs: null,
    });
  });

  it("flashes nothing for a wait that ends before the delay", () => {
    const times = run([
      ["start", 0],
      ["end", 150],
    ]);
    for (const now of [0, 150, 299, 300, 900]) {
      expect(derivePending(times, now).visible).toBe(false);
    }
  });

  it("holds the indicator for the minimum time once shown", () => {
    const times = run([
      ["start", 0],
      ["end", 400],
    ]);
    const hideAt = SHOW_AFTER_MS + MIN_SHOWN_MS;
    expect(derivePending(times, 399).visible).toBe(true);
    expect(derivePending(times, hideAt - 1)).toEqual({
      visible: true,
      recheckInMs: 1,
    });
    expect(derivePending(times, hideAt).visible).toBe(false);
  });

  it("hides at once for a long wait that ends", () => {
    const times = run([
      ["start", 0],
      ["end", 2000],
    ]);
    expect(derivePending(times, 1999).visible).toBe(true);
    expect(derivePending(times, 2000).visible).toBe(false);
  });
});

describe("nextPendingTimes", () => {
  it("ignores a repeated start and a stray end", () => {
    expect(run([["end", 5]])).toEqual(IDLE_PENDING);
    expect(
      run([
        ["start", 0],
        ["start", 50],
      ]),
    ).toEqual({ startedAt: 0, endedAt: null });
  });

  it("keeps a visible indicator when a new wait starts at once", () => {
    const times = run([
      ["start", 0],
      ["end", 400],
      ["start", 600],
    ]);
    expect(times).toEqual({ startedAt: 0, endedAt: null });
    expect(derivePending(times, 1200).visible).toBe(true);
  });

  it("starts fresh when the last indicator is already gone", () => {
    const times = run([
      ["start", 0],
      ["end", 100],
      ["start", 5000],
    ]);
    expect(times).toEqual({ startedAt: 5000, endedAt: null });
  });
});
