import { describe, expect, it } from "vite-plus/test";
import type { RelatedTask } from "./linked";
import { waitsOnRows } from "./waits-on-rows";

const task = (id: string, isCompleted = false): RelatedTask => ({
  id,
  title: id,
  status: "to-do",
  isCompleted,
  number: 1,
  projectId: "p",
  userId: null,
  assigneeName: null,
});

const rel = (
  id: string,
  type: string,
  source: RelatedTask,
  target: RelatedTask,
) => ({
  id,
  relationType: type,
  sourceTaskId: source.id,
  targetTaskId: target.id,
  sourceTask: source,
  targetTask: target,
});

const me = task("me");

describe("waitsOnRows", () => {
  it("lists blockers as waits-on and blocked tasks as needed-by", () => {
    const { waitsOn, neededBy } = waitsOnRows(
      [
        rel("r1", "blocks", task("api"), me),
        rel("r2", "blocks", me, task("app")),
      ],
      "me",
    );
    expect(waitsOn.map((r) => [r.relationId, r.task.id])).toEqual([
      ["r1", "api"],
    ]);
    expect(neededBy.map((r) => [r.relationId, r.task.id])).toEqual([
      ["r2", "app"],
    ]);
  });

  it("ignores subtask and related relations", () => {
    const { waitsOn, neededBy } = waitsOnRows(
      [
        rel("r1", "subtask", task("parent"), me),
        rel("r2", "related", me, task("other")),
      ],
      "me",
    );
    expect(waitsOn).toEqual([]);
    expect(neededBy).toEqual([]);
  });

  it("marks a finished blocker done and lists open ones first", () => {
    const { waitsOn } = waitsOnRows(
      [
        rel("r1", "blocks", task("old", true), me),
        rel("r2", "blocks", task("open"), me),
      ],
      "me",
    );
    expect(waitsOn.map((r) => [r.task.id, r.done])).toEqual([
      ["open", false],
      ["old", true],
    ]);
  });

  it("skips a relation whose other end is missing", () => {
    const broken = {
      ...rel("r1", "blocks", task("gone"), me),
      sourceTask: null,
    };
    expect(waitsOnRows([broken], "me").waitsOn).toEqual([]);
  });
});
