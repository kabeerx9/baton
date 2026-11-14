import { expect, it } from "vite-plus/test";
import { dayLabel } from "./day-label";

const now = new Date(2026, 10, 13, 15, 0);
const ago = (days: number, hour = 9) => new Date(2026, 10, 13 - days, hour, 0);

it("names today and yesterday by calendar day, not by 24 hours", () => {
  expect(dayLabel(ago(0, 1), now)).toBe("Today");
  expect(dayLabel(ago(1, 23), now)).toBe("Yesterday");
});

it("counts days within the week", () => {
  expect(dayLabel(ago(3), now)).toBe("3 days ago");
  expect(dayLabel(ago(6), now)).toBe("6 days ago");
});

it("switches to weeks after that", () => {
  expect(dayLabel(ago(7), now)).toBe("Last week");
  expect(dayLabel(ago(13), now)).toBe("Last week");
  expect(dayLabel(ago(14), now)).toBe("2 weeks ago");
  expect(dayLabel(ago(30), now)).toBe("4 weeks ago");
});

it("treats a time in the future as today", () => {
  expect(dayLabel(new Date(2026, 10, 14), now)).toBe("Today");
});
