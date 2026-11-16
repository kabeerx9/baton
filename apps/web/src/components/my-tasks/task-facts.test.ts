import { describe, expect, it } from "vite-plus/test";
import {
  finishBlock,
  peopleWaiting,
  priorityRank,
  taskKey,
} from "./task-facts";
import { assigned, link } from "./test-task";

describe("task facts", () => {
  it("ranks priorities and treats unknown as none", () => {
    expect(priorityRank("urgent")).toBeGreaterThan(priorityRank("high"));
    expect(priorityRank("no-priority")).toBe(0);
    expect(priorityRank(null)).toBe(0);
    expect(priorityRank("weird")).toBe(0);
  });

  it("builds the key with or without a number", () => {
    expect(taskKey({ number: 41, projectSlug: "APP" })).toBe("APP-41");
    expect(taskKey({ number: null, projectSlug: "T" })).toBe("T");
  });

  it("lists each waiting teammate once and skips unowned work", () => {
    const waiting = [
      link("A-1", "Neha Rao"),
      link("A-2", "Neha Rao"),
      link("A-3", null),
      link("A-4", "Priya Nair"),
    ];
    expect(peopleWaiting({ waiting })).toEqual(["Neha", "Priya"]);
  });
});

describe("finishBlock", () => {
  it("lets a free task be finished", () => {
    expect(finishBlock(assigned("a"))).toBeNull();
  });

  it("refuses a task that waits on open work, seen or hidden", () => {
    expect(finishBlock(assigned("a", { waitsOn: [link("B-1")] }))).toBe("held");
    expect(finishBlock(assigned("a", { hiddenBlockers: 1 }))).toBe("held");
  });

  it("refuses a listed task whose own status is already done", () => {
    expect(finishBlock(assigned("a", { status: "done" }))).toBe("feature");
  });
});
