import { describe, expect, it } from "vite-plus/test";
import { reconnectDelay } from "./reconnect-delay";

describe("reconnectDelay", () => {
  it("follows the schedule with a midpoint random", () => {
    expect(
      [1, 2, 3, 4, 5, 6, 7].map((failures) =>
        reconnectDelay(failures, () => 0.5),
      ),
    ).toEqual([750, 1250, 2250, 4250, 8250, 15250, 15250]);
  });

  it("never goes below the 500 ms floor", () => {
    for (const failures of [1, 3, 9]) {
      expect(reconnectDelay(failures, () => 0)).toBe(500);
    }
  });

  it("stays inside the window and caps at 30 s", () => {
    expect(reconnectDelay(1, () => 0.999999)).toBeLessThanOrEqual(1000);
    expect(reconnectDelay(3, () => 0.999999)).toBeLessThanOrEqual(4000);
    for (const failures of [6, 7, 50, 1e9]) {
      expect(reconnectDelay(failures, () => 0.999999)).toBeLessThanOrEqual(
        30_000,
      );
    }
  });

  it("stays finite for a very large failure count", () => {
    expect(Number.isFinite(reconnectDelay(Number.MAX_SAFE_INTEGER))).toBe(true);
  });

  it("treats a missing failure count as the first failure", () => {
    expect(reconnectDelay(0, () => 1)).toBe(1000);
  });
});
