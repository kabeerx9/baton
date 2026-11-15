import { describe, expect, it } from "vite-plus/test";
import { buildFocusPlan, headline, repoLoad, summaryParts } from "./focus-plan";
import { INITIAL_QUEUE, queueTransition } from "./queue-order";
import { assigned, dueIn, link } from "./test-task";

const day = new Date(2026, 10, 15).getTime();
const ids = (tasks: { id: string }[]) => tasks.map((t) => t.id);

const tasks = [
  assigned("late", { dueDate: dueIn(day, -2), priority: "urgent" }),
  assigned("blocker", {
    dueDate: dueIn(day, -1),
    waiting: [link("APP-61", "Priya Nair"), link("APP-62", "Rohan Mehta")],
  }),
  assigned("today", { dueDate: dueIn(day, 0) }),
  assigned("held", { dueDate: dueIn(day, 0), waitsOn: [link("DRF-11")] }),
  assigned("week", { dueDate: dueIn(day, 3), projectId: "p-api" }),
  assigned("later", {
    dueDate: dueIn(day, 20),
    waiting: [link("APP-48", "Neha Rao")],
  }),
  assigned("undated", { projectId: "p-api", projectName: "API" }),
];

describe("buildFocusPlan", () => {
  it("puts late work that holds teammates up first, with the reason", () => {
    const plan = buildFocusPlan(tasks, day, INITIAL_QUEUE);
    expect(plan.next?.id).toBe("blocker");
    expect(plan.reason).toEqual({ kind: "people", names: ["Priya", "Rohan"] });
    expect(ids(plan.queue)).toEqual([
      "blocker",
      "late",
      "today",
      "later",
      "week",
      "undated",
    ]);
  });

  it("keeps held tasks out of the queue and the buckets", () => {
    const plan = buildFocusPlan(tasks, day, INITIAL_QUEUE);
    expect(ids(plan.held)).toEqual(["held"]);
    expect(ids(plan.overdue)).toEqual(["late"]);
    expect(ids(plan.today)).toEqual(["today"]);
    expect(ids(plan.thisWeek)).toEqual(["week"]);
    expect(ids(plan.later)).toEqual(["later", "undated"]);
    expect(plan.queue.length + plan.held.length).toBe(tasks.length);
  });

  it("moves a skipped task to the back and a pinned task to the front", () => {
    const skipped = queueTransition(INITIAL_QUEUE, {
      type: "skip",
      id: "blocker",
    });
    const afterSkip = buildFocusPlan(tasks, day, skipped);
    expect(afterSkip.next?.id).toBe("late");
    expect(afterSkip.queue.at(-1)?.id).toBe("blocker");

    const pinned = queueTransition(INITIAL_QUEUE, { type: "pin", id: "week" });
    const afterPin = buildFocusPlan(tasks, day, pinned);
    expect(afterPin.next?.id).toBe("week");
    expect(afterPin.reason).toEqual({ kind: "picked" });
  });

  it("keeps a real reason on a pinned task that has one", () => {
    const pinned = queueTransition(INITIAL_QUEUE, { type: "pin", id: "later" });
    expect(buildFocusPlan(tasks, day, pinned).reason).toEqual({
      kind: "people",
      names: ["Neha"],
    });
  });

  it("ignores a pin on a task that is no longer in the queue", () => {
    const gone = queueTransition(INITIAL_QUEUE, { type: "pin", id: "gone" });
    expect(buildFocusPlan(tasks, day, gone).next?.id).toBe("blocker");
    const held = queueTransition(INITIAL_QUEUE, { type: "pin", id: "held" });
    expect(buildFocusPlan(tasks, day, held).next?.id).toBe("blocker");
  });

  it("lists each teammate once, the most urgent blocker first", () => {
    const { people, counts } = buildFocusPlan(tasks, day, INITIAL_QUEUE);
    expect(people.map((p) => p.name)).toEqual(["Priya", "Rohan", "Neha"]);
    expect(counts.waiting).toBe(3);
    expect(people[0]?.stuck[0]?.key).toBe("APP-61");
    expect(people[0]?.stuck[0]?.blocker.id).toBe("blocker");
  });

  it("gathers one teammate's stuck tasks on one card, and unowned work on another", () => {
    const blocker = assigned("x", {
      waiting: [
        link("APP-1", "Neha Rao"),
        link("APP-2", "Neha Rao"),
        link("APP-3", null),
      ],
    });
    const { people, counts } = buildFocusPlan([blocker], day, INITIAL_QUEUE);
    expect(people.map((p) => [p.name, p.stuck.map((s) => s.key)])).toEqual([
      ["Neha", ["APP-1", "APP-2"]],
      [null, ["APP-3"]],
    ]);
    // Unowned work is nobody waiting: the headline counts people.
    expect(counts.waiting).toBe(1);
  });

  it("lists the tasks due on each of the next seven days, held ones too", () => {
    const { week } = buildFocusPlan(tasks, day, INITIAL_QUEUE);
    expect(week.map((d) => d.length)).toEqual([2, 0, 0, 1, 0, 0, 0]);
  });

  it("returns an empty plan for no tasks", () => {
    const plan = buildFocusPlan([], day, INITIAL_QUEUE);
    expect(plan.next).toBeNull();
    expect(plan.reason).toBeNull();
    expect(headline(plan)).toEqual({ kind: "clear" });
    expect(summaryParts(plan)).toEqual([]);
  });
});

describe("headline", () => {
  const of = (list: typeof tasks) =>
    headline(buildFocusPlan(list, day, INITIAL_QUEUE));

  it("leads with people, then late work, then today", () => {
    expect(of(tasks)).toEqual({ kind: "waiting", count: 3 });
    const quiet = tasks.filter((t) => t.waiting.length === 0);
    expect(of(quiet)).toEqual({ kind: "overdue", count: 1 });
    expect(of(quiet.filter((t) => t.id !== "late"))).toEqual({
      kind: "today",
      count: 1,
    });
  });

  it("has a sentence for a calm day and for held work only", () => {
    expect(of([assigned("a")])).toEqual({ kind: "nothingDue" });
    expect(of([assigned("a", { hiddenBlockers: 1 })])).toEqual({
      kind: "heldOnly",
    });
  });

  it("counts under the headline skip zeros and held tasks' dates", () => {
    expect(summaryParts(buildFocusPlan(tasks, day, INITIAL_QUEUE))).toEqual([
      { count: 2, part: "overdue" },
      { count: 1, part: "today" },
      { count: 1, part: "week" },
      { count: 1, part: "held" },
    ]);
  });
});

describe("repoLoad", () => {
  it("counts open tasks per repo, the fullest first, then by name", () => {
    expect(repoLoad(tasks).map((r) => [r.id, r.count])).toEqual([
      ["p-app", 5],
      ["p-api", 2],
    ]);
  });
});
