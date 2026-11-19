import { describe, expect, it } from "vite-plus/test";
import { columnOf, summarizeFeature } from "./feature-status";
import { blockerOf, feature, person, request, task } from "./test-fixtures";

const kabeer = person("u1", "Kabeer");
const aisha = person("u2", "Aisha");
const none = {
  waitsOn: [],
  blocks: [],
  boardTasks: [],
  memberName: () => null,
};

describe("summarizeFeature counts and status", () => {
  it("counts tasks by column and reads moving", () => {
    const f = feature("T-1", [
      task({ key: "A-1", status: "done", owner: kabeer }),
      task({ key: "A-2", status: "doing", owner: kabeer }),
      task({ key: "A-3", status: "review", owner: aisha }),
      task({ key: "A-4", status: "todo" }),
    ]);
    const s = summarizeFeature(f, none);
    expect(s.counts).toEqual({ todo: 1, doing: 1, review: 1, done: 1 });
    expect(s.total).toBe(4);
    expect(s.status).toEqual({ kind: "moving" });
    expect(s.owners.map((o) => o.person?.name ?? null)).toEqual([
      "Kabeer",
      "Aisha",
      null,
    ]);
  });

  it("reads done, not started and empty", () => {
    const done = feature("T-2", [task({ key: "A-1", status: "done" })]);
    expect(summarizeFeature(done, none).status.kind).toBe("done");
    const fresh = feature("T-3", [task({ key: "A-1" }), task({ key: "A-2" })]);
    expect(summarizeFeature(fresh, none).status.kind).toBe("notStarted");
    expect(summarizeFeature(feature("T-4", []), none).status.kind).toBe(
      "empty",
    );
  });

  it("treats an unknown status as not started, never as done", () => {
    const odd = { ...task({ key: "A-1" }), status: "archived" as never };
    expect(columnOf(odd)).toBe("todo");
    const s = summarizeFeature(feature("T-5", [odd]), none);
    expect(s.counts).toEqual({ todo: 1, doing: 0, review: 0, done: 0 });
    expect(s.status.kind).toBe("notStarted");
  });
});

describe("blocked and needs attention", () => {
  const first = task({ key: "API-1", status: "doing", owner: aisha });
  const blockedBy = (key: string, outside = false) =>
    task({
      key,
      owner: kabeer,
      waitsOn: [
        outside
          ? { id: "x", key: "APP-9", title: "Other", assigneeName: "Rohan" }
          : blockerOf(first),
      ],
    });

  it("lists blocked tasks with inside and outside blockers", () => {
    const s = summarizeFeature(
      feature("T-1", [first, blockedBy("WEB-1"), blockedBy("WEB-2", true)]),
      none,
    );
    expect(s.held.map((h) => [h.kind, h.task.key])).toEqual([
      ["blocked", "WEB-1"],
      ["blocked", "WEB-2"],
    ]);
    const [a, b] = s.held;
    expect(a?.kind === "blocked" && a.inside.map((x) => x.key)).toEqual([
      "API-1",
    ]);
    expect(b?.kind === "blocked" && b.outside.map((x) => x.key)).toEqual([
      "APP-9",
    ]);
    expect(s.free.map((t) => t.key)).toEqual(["API-1"]);
  });

  it("counts a hidden blocker as blocked", () => {
    const s = summarizeFeature(
      feature("T-1", [task({ key: "A-1", hiddenBlockers: 1 })]),
      none,
    );
    expect(s.held[0]?.kind).toBe("blocked");
    expect(s.status.kind).toBe("stuck");
  });

  it("does not hold a done task, even with a stale blocker", () => {
    const s = summarizeFeature(
      feature("T-1", [
        task({ key: "A-1", status: "done", waitsOn: [blockerOf(first)] }),
      ]),
      none,
    );
    expect(s.held).toEqual([]);
  });

  it("is stuck when every open task is blocked, asking when one is asked", () => {
    const stuck = summarizeFeature(
      feature("T-1", [blockedBy("WEB-1"), blockedBy("WEB-2")]),
      none,
    );
    expect(stuck.status.kind).toBe("stuck");
    const asking = summarizeFeature(
      feature("T-2", [
        blockedBy("WEB-1"),
        task({ key: "WEB-3", status: "doing", request: request("u2") }),
      ]),
      { ...none, memberName: (id) => (id === "u2" ? "Aisha Khan" : null) },
    );
    expect(asking.status.kind).toBe("asking");
    const asked = asking.held.find((h) => h.kind === "asked");
    expect(asked?.kind === "asked" && asked.requester).toBe("Aisha Khan");
  });

  it("lets blocked win over asked on the same task", () => {
    const both = task({
      key: "A-1",
      waitsOn: [blockerOf(first)],
      request: request("u2"),
    });
    expect(summarizeFeature(feature("T-1", [both]), none).held[0]?.kind).toBe(
      "blocked",
    );
  });
});

describe("dependents: tasks elsewhere that wait on ours", () => {
  const a = task({ key: "A-1", status: "doing" });
  const b = task({ key: "A-2" });

  it("lists a task elsewhere that waits on one of ours", () => {
    const other = feature("T-9", [
      task({ key: "Z-1", waitsOn: [blockerOf(a)] }),
    ]);
    const s = summarizeFeature(feature("T-1", [a, b]), {
      ...none,
      boardTasks: [other],
    });
    expect(s.dependents.map((d) => [d.from, d.to.key])).toEqual([
      ["A-1", "Z-1"],
    ]);
  });

  it("ignores a done task elsewhere and links inside the same feature", () => {
    const other = feature("T-9", [
      task({ key: "Z-1", status: "done", waitsOn: [blockerOf(a)] }),
    ]);
    const s = summarizeFeature(feature("T-1", [a, b]), {
      ...none,
      boardTasks: [other],
    });
    expect(s.dependents).toEqual([]);
  });
});
