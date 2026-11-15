import { describe, expect, it } from "vite-plus/test";
import { formatAgo, isStale } from "./time";

const NOW = Date.parse("2026-11-15T12:00:00Z");
const ago = (ms: number) => new Date(NOW - ms).toISOString();
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

describe("formatAgo", () => {
  it.each([
    [10_000, "just now"],
    [5 * MIN, "5 min ago"],
    [HOUR, "1 hour ago"],
    [3 * HOUR, "3 hours ago"],
    [DAY, "yesterday"],
    [12 * DAY, "12 days ago"],
  ])("%d ms is %s", (ms, label) => {
    expect(formatAgo(ago(ms), NOW)).toBe(label);
  });

  it("treats an unparseable date as just now", () => {
    expect(formatAgo("nope", NOW)).toBe("just now");
  });
});

describe("isStale", () => {
  it("flags 60 days without use", () => {
    expect(isStale(ago(61 * DAY), ago(90 * DAY), NOW)).toBe(true);
    expect(isStale(ago(59 * DAY), ago(90 * DAY), NOW)).toBe(false);
  });

  it("falls back to creation when never used", () => {
    expect(isStale(null, ago(70 * DAY), NOW)).toBe(true);
    expect(isStale(null, ago(2 * DAY), NOW)).toBe(false);
  });
});
