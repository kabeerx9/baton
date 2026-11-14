import { expect, it } from "vite-plus/test";
import { otherEnds, type RelatedTask, type Relation } from "./linked";

const task = (id: string): RelatedTask => ({
  id,
  title: id,
  status: "to-do",
  isCompleted: false,
  number: 1,
  projectId: "p",
  userId: null,
  assigneeName: null,
});

const rel = (type: string, source: string, target: string): Relation => ({
  relationType: type,
  sourceTaskId: source,
  targetTaskId: target,
  sourceTask: task(source),
  targetTask: task(target),
});

// me waits on "api"; "app" waits on me; "parent" owns me; "child" is mine.
const relations = [
  rel("blocks", "api", "me"),
  rel("blocks", "me", "app"),
  rel("subtask", "parent", "me"),
  rel("subtask", "me", "child"),
  rel("related", "me", "other"),
];
const ids = (tasks: RelatedTask[]) => tasks.map((t) => t.id);

it("returns what the task waits on", () => {
  expect(ids(otherEnds(relations, "me", "blocks", "target"))).toEqual(["api"]);
});

it("returns what waits on the task", () => {
  expect(ids(otherEnds(relations, "me", "blocks", "source"))).toEqual(["app"]);
});

it("returns the parent and the subtasks", () => {
  expect(ids(otherEnds(relations, "me", "subtask", "target"))).toEqual([
    "parent",
  ]);
  expect(ids(otherEnds(relations, "me", "subtask", "source"))).toEqual([
    "child",
  ]);
});

it("ignores other relation types and tasks the caller cannot see", () => {
  const hidden = { ...rel("blocks", "secret", "me"), sourceTask: null };
  expect(
    otherEnds([hidden, rel("related", "x", "me")], "me", "blocks", "target"),
  ).toEqual([]);
});
