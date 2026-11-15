import { describe, expect, it } from "vite-plus/test";
import { byUrgency, daysUntil, reasonFor } from "./rank";
import { assigned, dueIn, link } from "./test-task";

const day = new Date(2026, 10, 15).getTime();
const ids = (tasks: { id: string }[]) => tasks.map((t) => t.id);

describe("byUrgency", () => {
  it("puts late work that holds people up first, then late, today, blocking, the rest", () => {
    const tasks = [
      assigned("rest", { dueDate: dueIn(day, 3), priority: "urgent" }),
      assigned("blocking", { waiting: [link("A-1", "Neha Rao")] }),
      assigned("today", { dueDate: dueIn(day, 0) }),
      assigned("late", { dueDate: dueIn(day, -2) }),
      assigned("late-blocking", {
        dueDate: dueIn(day, -1),
        waiting: [link("A-2", "Priya Nair")],
      }),
    ];
    expect(ids(tasks.sort(byUrgency(day)))).toEqual([
      "late-blocking",
      "late",
      "today",
      "blocking",
      "rest",
    ]);
  });

  it("breaks a tie by priority, then the nearer date, then the key", () => {
    const tasks = [
      assigned("c", { number: 3 }),
      assigned("b", { number: 2, dueDate: dueIn(day, 4) }),
      assigned("a", { number: 9, priority: "high" }),
      assigned("d", { number: 1 }),
    ];
    expect(ids(tasks.sort(byUrgency(day)))).toEqual(["a", "b", "d", "c"]);
  });
});

describe("reasonFor", () => {
  it("names who waits before anything else", () => {
    const task = assigned("a", {
      dueDate: dueIn(day, -3),
      waiting: [link("A-1", "Priya Nair"), link("A-2", "Rohan Mehta")],
    });
    expect(reasonFor(task, day)).toEqual({
      kind: "people",
      names: ["Priya", "Rohan"],
    });
  });

  it("counts waiting tasks when nobody owns them", () => {
    const task = assigned("a", { waiting: [link("A-1"), link("A-2")] });
    expect(reasonFor(task, day)).toEqual({ kind: "tasks", count: 2 });
  });

  it("falls back to the date, then priority, then the queue", () => {
    expect(reasonFor(assigned("a", { dueDate: dueIn(day, -2) }), day)).toEqual({
      kind: "overdue",
      days: 2,
    });
    expect(reasonFor(assigned("a", { dueDate: dueIn(day, 0) }), day)).toEqual({
      kind: "today",
    });
    expect(reasonFor(assigned("a", { priority: "high" }), day)).toEqual({
      kind: "priority",
    });
    expect(reasonFor(assigned("a"), day)).toEqual({ kind: "next" });
  });
});

describe("daysUntil", () => {
  it("is null with no date and negative when overdue", () => {
    expect(daysUntil(assigned("a"), day)).toBeNull();
    expect(daysUntil(assigned("a", { dueDate: dueIn(day, -2) }), day)).toBe(-2);
  });
});
