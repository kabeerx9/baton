import { describe, expect, it } from "vite-plus/test";
import type { BoardTask, Subtask } from "../model";
import { boardTaskFixture, subtaskFixture } from "../test-fixtures";
import { waitsOnCandidates } from "./waits-on-candidates";

const sub = (id: string, blockedBy: string[] = []): Subtask =>
  subtaskFixture(id, { blockedBy });

const item = (id: string, subtasks: Subtask[] = []): BoardTask =>
  boardTaskFixture(id, { subtasks });

const ids = (list: { id: string }[]) => list.map((c) => c.id);

describe("waitsOnCandidates", () => {
  const board = [
    item("feat", [sub("a"), sub("b", ["a"]), sub("c", ["b"])]),
    item("solo"),
  ];

  it("offers subtasks and standalone tasks, never a feature", () => {
    expect(ids(waitsOnCandidates(board, "x", new Set()))).toEqual([
      "a",
      "b",
      "c",
      "solo",
    ]);
  });

  it("leaves out the task itself and tasks already linked", () => {
    expect(ids(waitsOnCandidates(board, "b", new Set(["solo"])))).toEqual([
      "a",
    ]);
  });

  it("leaves out tasks that wait on this one, directly or not", () => {
    expect(ids(waitsOnCandidates(board, "a", new Set()))).toEqual(["solo"]);
  });

  it("stops on a loop that already exists", () => {
    const loop = [item("f", [sub("a", ["b"]), sub("b", ["a"])])];
    expect(ids(waitsOnCandidates(loop, "a", new Set()))).toEqual([]);
  });
});
