import { describe, expect, it } from "vite-plus/test";
import { DONE_WINDOW_DAYS, doneSince } from "./done-window";

describe("doneSince", () => {
  it("is local midnight minus the window, whatever the time of day", () => {
    const morning = new Date(2026, 10, 17, 0, 5);
    const night = new Date(2026, 10, 17, 23, 55);
    const expected = new Date(2026, 10, 17 - DONE_WINDOW_DAYS).toISOString();
    expect(doneSince(morning)).toBe(expected);
    expect(doneSince(night)).toBe(expected);
  });

  it("moves when the local day changes", () => {
    expect(doneSince(new Date(2026, 10, 18, 0, 1))).not.toBe(
      doneSince(new Date(2026, 10, 17, 23, 59)),
    );
  });
});
