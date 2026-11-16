import { act, render } from "@testing-library/react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { BREAK_TOTAL_MS, COVER_AT_MS, FinishBreak } from "./finish-break";

function stubMotion(reduce: boolean) {
  vi.stubGlobal("matchMedia", () => ({
    matches: reduce,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("FinishBreak", () => {
  it("shatters, covers the screen once, then finishes in under 2.5s", () => {
    stubMotion(false);
    const onCovered = vi.fn();
    const onDone = vi.fn();
    const { container } = render(
      <FinishBreak onCovered={onCovered} onDone={onDone} />,
    );
    expect(container.querySelector('[data-mode="shatter"]')).not.toBeNull();
    // Shards are clipped panels, moved only by transform and opacity.
    expect(
      container.querySelectorAll("div[style*='clip-path']").length,
    ).toBeGreaterThan(10);

    act(() => vi.advanceTimersByTime(COVER_AT_MS - 1));
    expect(onCovered).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onCovered).toHaveBeenCalledTimes(1);
    expect(onDone).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(BREAK_TOTAL_MS));
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onCovered).toHaveBeenCalledTimes(1);
    expect(BREAK_TOTAL_MS).toBeGreaterThan(1500);
    expect(BREAK_TOTAL_MS).toBeLessThan(2500);
  });

  it("crossfades instead when motion is reduced", () => {
    stubMotion(true);
    const onCovered = vi.fn();
    const onDone = vi.fn();
    const { container } = render(
      <FinishBreak onCovered={onCovered} onDone={onDone} />,
    );
    expect(container.querySelector('[data-mode="fade"]')).not.toBeNull();
    expect(container.querySelector("div[style*='clip-path']")).toBeNull();
    act(() => vi.advanceTimersByTime(1000));
    expect(onCovered).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
