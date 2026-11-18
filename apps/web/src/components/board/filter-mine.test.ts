import { describe, expect, it } from "vite-plus/test";
import { applyView, filterMine } from "./filter-mine";
import type { Person } from "./model";
import { boardTaskFixture, subtaskFixture } from "./test-fixtures";

const person = (id: string): Person => ({
  id,
  name: id,
  initials: id[0]!.toUpperCase(),
  hue: 0,
  image: null,
});

describe("filterMine", () => {
  it("keeps a task assigned to me", () => {
    const mine = boardTaskFixture("a", { assignee: person("me") });
    expect(filterMine([mine], "me")).toEqual([mine]);
  });

  it("keeps a feature when only a subtask is mine, with every subtask", () => {
    const feature = boardTaskFixture("f", {
      assignee: person("lead"),
      subtasks: [
        subtaskFixture("s1", { assignee: person("other") }),
        subtaskFixture("s2", { assignee: person("me") }),
        subtaskFixture("s3"),
      ],
    });
    const [kept] = filterMine([feature], "me");
    expect(kept?.subtasks).toHaveLength(3);
  });

  it("drops unassigned cards and cards of someone else", () => {
    const tasks = [
      boardTaskFixture("none"),
      boardTaskFixture("theirs", {
        assignee: person("other"),
        subtasks: [subtaskFixture("s", { assignee: person("other") })],
      }),
    ];
    expect(filterMine(tasks, "me")).toEqual([]);
  });

  it("matches nothing without a user id", () => {
    const task = boardTaskFixture("a", { assignee: person("me") });
    expect(filterMine([task], undefined)).toEqual([]);
  });
});

describe("applyView", () => {
  const mine = boardTaskFixture("a", { assignee: person("me") });
  const other = boardTaskFixture("b");
  it("returns every card for all", () => {
    expect(applyView("all", [mine, other], "me")).toEqual([mine, other]);
  });
  it("filters for mine", () => {
    expect(applyView("mine", [mine, other], "me")).toEqual([mine]);
  });
});
