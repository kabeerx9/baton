import { type Person, type Status, toStatus } from "../model";

/** A task as the chain and the side list show it. */
export type LinkedTask = {
  id: string;
  projectId: string;
  key: string;
  title: string;
  status: Status;
  owner: Person | null;
  /** Set for board items, where the API says if an open task holds it up. */
  blocked?: boolean;
};

/** The other task of a relation, as the API returns it. */
export type RelatedTask = {
  id: string;
  title: string;
  status: string;
  isCompleted: boolean;
  number: number | null;
  projectId: string;
  userId: string | null;
  assigneeName: string | null;
  /** From the API: the task still holds up work that waits on it (BOARD.md rule 5). */
  open?: boolean;
};

/**
 * The status of a linked task the board may not list. `open` is the API's
 * answer, so an old done feature is done whatever status is stored on it,
 * and an open one is never shown as done.
 */
export function linkedStatus(related: RelatedTask): Status {
  const stored = toStatus(related);
  if (related.open === undefined) return stored;
  if (!related.open) return "done";
  return stored === "done" ? "doing" : stored;
}

export type Relation = {
  relationType: string;
  sourceTaskId: string;
  targetTaskId: string;
  sourceTask: RelatedTask | null;
  targetTask: RelatedTask | null;
};

/**
 * The tasks on the other end of one kind of relation.
 * In "blocks" and "subtask" relations the source is the blocker or the
 * parent, so `side: "source"` reads "this task is the source": it returns
 * what this task blocks, or its subtasks. `side: "target"` returns what it
 * waits on, or its parent.
 */
export function otherEnds(
  relations: Relation[],
  taskId: string,
  type: "blocks" | "subtask",
  side: "source" | "target",
): RelatedTask[] {
  return relations.flatMap((rel) => {
    if (rel.relationType !== type) return [];
    const isMine =
      side === "source"
        ? rel.sourceTaskId === taskId
        : rel.targetTaskId === taskId;
    const other = side === "source" ? rel.targetTask : rel.sourceTask;
    return isMine && other ? [other] : [];
  });
}
