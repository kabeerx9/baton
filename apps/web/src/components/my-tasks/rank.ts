import { differenceInCalendarDays } from "date-fns";
import type { AssignedTask } from "@/fetchers/task/get-assigned-tasks";
import { isBlocking, peopleWaiting, priorityRank, taskKey } from "./task-facts";

/** Calendar days until the due date in the viewer's timezone. Negative is overdue. */
export function daysUntil(
  task: Pick<AssignedTask, "dueDate">,
  day: number,
): number | null {
  return task.dueDate
    ? differenceInCalendarDays(new Date(task.dueDate), new Date(day))
    : null;
}

/** Lower is more urgent. Someone waiting and a date that has come beat everything. */
function tier(task: AssignedTask, day: number): number {
  const days = daysUntil(task, day);
  const due = days !== null && days <= 0;
  if (isBlocking(task) && due) return 0;
  if (days !== null && days < 0) return 1;
  if (days === 0) return 2;
  if (isBlocking(task)) return 3;
  return 4;
}

/** The page's one order: who waits, then dates, then priority, then the key. */
export function byUrgency(day: number) {
  return (a: AssignedTask, b: AssignedTask) => {
    const byTier = tier(a, day) - tier(b, day);
    if (byTier !== 0) return byTier;
    const byPriority = priorityRank(b.priority) - priorityRank(a.priority);
    if (byPriority !== 0) return byPriority;
    const da = daysUntil(a, day) ?? Number.POSITIVE_INFINITY;
    const db = daysUntil(b, day) ?? Number.POSITIVE_INFINITY;
    if (da !== db) return da - db;
    return taskKey(a).localeCompare(taskKey(b));
  };
}

/** Why a task is first. The words are chosen where it is shown. */
export type Reason =
  | { kind: "people"; names: string[] }
  | { kind: "tasks"; count: number }
  | { kind: "overdue"; days: number }
  | { kind: "today" }
  | { kind: "priority" }
  | { kind: "next" }
  | { kind: "picked" };

export function reasonFor(task: AssignedTask, day: number): Reason {
  const names = peopleWaiting(task);
  if (names.length > 0) return { kind: "people", names };
  if (isBlocking(task)) return { kind: "tasks", count: task.waiting.length };
  const days = daysUntil(task, day);
  if (days !== null && days < 0) return { kind: "overdue", days: -days };
  if (days === 0) return { kind: "today" };
  if (priorityRank(task.priority) >= 3) return { kind: "priority" };
  return { kind: "next" };
}
