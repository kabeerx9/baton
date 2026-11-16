import { isBlocked } from "@/components/board/model";
import type { AssignedTask } from "@/fetchers/task/get-assigned-tasks";

/** The column slug every project starts with for finished work. */
export const DONE_STATUS = "done";

const PRIORITY_RANK: Record<string, number> = {
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1,
};

/** Higher is more pressing. Unknown and "no-priority" rank 0. */
export function priorityRank(priority: string | null | undefined): number {
  return PRIORITY_RANK[priority ?? ""] ?? 0;
}

/** "APP-41". A task with no number shows its repo slug alone, like the rest of the app. */
export function taskKey(task: Pick<AssignedTask, "number" | "projectSlug">) {
  return task.number == null
    ? task.projectSlug
    : `${task.projectSlug}-${task.number}`;
}

/** My task holds up someone else's open work. */
export function isBlocking(task: Pick<AssignedTask, "waiting">): boolean {
  return task.waiting.length > 0;
}

export function firstName(name: string): string {
  return name.split(" ")[0] ?? name;
}

/** Distinct teammates a task holds up, by first name, in order. Unowned work names nobody. */
export function peopleWaiting(task: Pick<AssignedTask, "waiting">): string[] {
  const names = task.waiting.flatMap((w) =>
    w.assigneeName ? [firstName(w.assigneeName)] : [],
  );
  return [...new Set(names)];
}

/**
 * Why "mark done" cannot finish this task, or null when it can.
 * - Rule 5 in BOARD.md: a task that waits on open work cannot be finished.
 * - A task that is still listed although its own status is done is a feature:
 *   it closes when the tasks under it do (rule 3), so a status write does nothing.
 */
export function finishBlock(
  task: Pick<AssignedTask, "status" | "waitsOn" | "hiddenBlockers">,
): "held" | "feature" | null {
  if (isBlocked(task)) return "held";
  if (task.status === DONE_STATUS) return "feature";
  return null;
}
