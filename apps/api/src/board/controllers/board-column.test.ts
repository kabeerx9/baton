import { describe, expect, it } from "vite-plus/test";
import { boardColumn } from "./board-column";

const task = (status: string, isCompleted = false) => ({ status, isCompleted });
const done = task("done", true);

describe("boardColumn", () => {
  it("uses the task's own status when it has no subtasks", () => {
    expect(boardColumn(task("to-do"), [])).toBe("todo");
    expect(boardColumn(task("in-progress"), [])).toBe("doing");
    expect(boardColumn(task("in-review"), [])).toBe("review");
    expect(boardColumn(done, [])).toBe("done");
  });

  it("puts a completed task in done even if its status slug says review", () => {
    expect(boardColumn(task("in-review", true), [])).toBe("done");
  });

  it("treats an unknown status as not started", () => {
    expect(boardColumn(task("someday"), [])).toBe("todo");
    expect(boardColumn(task("to-do"), [task("someday")])).toBe("todo");
    expect(
      boardColumn(task("to-do"), [task("in-review"), task("someday")]),
    ).toBe("doing");
  });

  it("ignores the task's own status once it has subtasks", () => {
    expect(boardColumn(done, [task("to-do")])).toBe("todo");
    expect(boardColumn(task("in-review"), [task("to-do")])).toBe("todo");
    expect(boardColumn(task("to-do"), [done])).toBe("done");
  });

  it("is in progress when some subtasks have started or finished", () => {
    expect(boardColumn(task("to-do"), [done, task("to-do")])).toBe("doing");
    expect(
      boardColumn(task("to-do"), [task("in-progress"), task("to-do")]),
    ).toBe("doing");
    expect(
      boardColumn(task("to-do"), [task("in-review"), task("in-progress")]),
    ).toBe("doing");
  });

  it("is in review when every unfinished subtask is in review", () => {
    expect(boardColumn(task("to-do"), [task("in-review")])).toBe("review");
    expect(boardColumn(task("to-do"), [done, task("in-review")])).toBe(
      "review",
    );
    expect(
      boardColumn(task("to-do"), [task("in-review"), task("in-review")]),
    ).toBe("review");
  });

  it("is done only when every subtask is done", () => {
    expect(boardColumn(task("to-do"), [done, done])).toBe("done");
  });
});
