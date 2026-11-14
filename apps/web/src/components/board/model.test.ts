import { describe, expect, it } from "vite-plus/test";
import { hiddenBlockerCount, isBlocked, progress, waitingOn } from "./model";
import { blocker, boardTaskFixture, subtaskFixture } from "./test-fixtures";

describe("isBlocked", () => {
  it("is false with no open blocker", () => {
    expect(isBlocked(subtaskFixture("a"))).toBe(false);
  });

  it("is true for a visible blocker", () => {
    expect(
      isBlocked(subtaskFixture("a", { waitsOn: [blocker("API-1")] })),
    ).toBe(true);
  });

  it("is true when only hidden blockers remain", () => {
    expect(isBlocked(subtaskFixture("a", { hiddenBlockers: 1 }))).toBe(true);
  });

  it("ignores blockedBy, which is map edges only", () => {
    expect(isBlocked(subtaskFixture("a", { blockedBy: ["b"] }))).toBe(false);
  });

  it("covers a single task that is not part of a feature", () => {
    expect(
      isBlocked(boardTaskFixture("t30", { waitsOn: [blocker("T-9")] })),
    ).toBe(true);
  });
});

describe("waitingOn", () => {
  it("joins the feature's and its subtasks' blockers once each", () => {
    const shared = blocker("APP-15", "Sam");
    const feature = boardTaskFixture("f", {
      waitsOn: [blocker("T-2")],
      subtasks: [
        subtaskFixture("a", { waitsOn: [shared] }),
        subtaskFixture("b", { waitsOn: [shared, blocker("API-4")] }),
        subtaskFixture("c"),
      ],
    });
    expect(waitingOn(feature).map((b) => b.key)).toEqual([
      "T-2",
      "APP-15",
      "API-4",
    ]);
  });

  it("counts hidden blockers across the feature and its subtasks", () => {
    const feature = boardTaskFixture("f", {
      hiddenBlockers: 1,
      subtasks: [subtaskFixture("a", { hiddenBlockers: 2 })],
    });
    expect(hiddenBlockerCount(feature)).toBe(3);
  });
});

describe("progress", () => {
  it("keeps started work apart from done work", () => {
    const tasks = [
      subtaskFixture("a", { status: "done" }),
      subtaskFixture("b", { status: "doing" }),
      subtaskFixture("c", { status: "review" }),
      subtaskFixture("d"),
    ];
    expect(progress(tasks)).toMatchObject({
      done: 1,
      started: 2,
      total: 4,
      ratio: 0.25,
      startedRatio: 0.75,
    });
  });

  it("shows a started feature as above zero", () => {
    expect(
      progress([subtaskFixture("a", { status: "doing" })]).startedRatio,
    ).toBe(1);
  });
});
