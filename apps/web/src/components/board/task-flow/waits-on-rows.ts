import { toStatus } from "../model";
import type { RelatedTask } from "./linked";

/** A relation as the API returns it, with its id so it can be removed. */
type RelationWithId = {
  id: string;
  relationType: string;
  sourceTaskId: string;
  targetTaskId: string;
  sourceTask: RelatedTask | null;
  targetTask: RelatedTask | null;
};

export type WaitsOnRow = {
  relationId: string;
  task: RelatedTask;
  done: boolean;
};

// Open work first: it is what the reader has to act on. Order is otherwise kept.
function openFirst(rows: WaitsOnRow[]) {
  return [...rows].sort((a, b) => Number(a.done) - Number(b.done));
}

/**
 * What a task waits on, and what waits on it. A "blocks" relation has the
 * blocker as its source, so this task waits on the sources that point at it.
 */
export function waitsOnRows(relations: RelationWithId[], taskId: string) {
  const waitsOn: WaitsOnRow[] = [];
  const neededBy: WaitsOnRow[] = [];
  for (const rel of relations) {
    if (rel.relationType !== "blocks") continue;
    const row = (task: RelatedTask | null) =>
      task
        ? { relationId: rel.id, task, done: toStatus(task) === "done" }
        : null;
    if (rel.targetTaskId === taskId) {
      const found = row(rel.sourceTask);
      if (found) waitsOn.push(found);
    } else if (rel.sourceTaskId === taskId) {
      const found = row(rel.targetTask);
      if (found) neededBy.push(found);
    }
  }
  return { waitsOn: openFirst(waitsOn), neededBy: openFirst(neededBy) };
}
