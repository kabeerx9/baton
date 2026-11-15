import { describe, expect, it } from "vite-plus/test";
import { describeDue } from "./due-info";
import { dueIn } from "./test-task";

const day = new Date(2026, 10, 15).getTime();
const kind = (offset: number) => describeDue(dueIn(day, offset), day).kind;

describe("describeDue", () => {
  it("has nothing to say with no date", () => {
    expect(describeDue(null, day)).toEqual({ kind: "none" });
  });

  it("counts whole days late", () => {
    expect(describeDue(dueIn(day, -3), day)).toEqual({
      kind: "overdue",
      days: 3,
    });
  });

  it("names today and tomorrow, a weekday within the week, then a date", () => {
    expect(kind(0)).toBe("today");
    expect(kind(1)).toBe("tomorrow");
    expect(kind(2)).toBe("weekday");
    expect(kind(6)).toBe("weekday");
    expect(kind(7)).toBe("date");
  });

  it("uses the calendar day, not 24 hours", () => {
    const lateTonight = new Date(day);
    lateTonight.setHours(23, 59);
    expect(describeDue(lateTonight.toISOString(), day).kind).toBe("today");
  });
});
