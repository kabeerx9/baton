import type { AssignedTask } from "@/fetchers/task/get-assigned-tasks";
import { orderQueue, pinnedId, type QueueOrder } from "./queue-order";
import { byUrgency, daysUntil, type Reason, reasonFor } from "./rank";
import { finishBlock, firstName } from "./task-facts";

export type WaitingPerson = {
  /** First name, or null for stuck work that nobody owns. One card per name. */
  name: string | null;
  fullName: string | null;
  /** Their tasks that cannot move, each with the task of mine that holds it. */
  stuck: { key: string; title: string; blocker: AssignedTask }[];
};

export type FocusCounts = {
  overdue: number;
  today: number;
  week: number;
  held: number;
  /** Distinct named teammates with work held up by one of my tasks. */
  waiting: number;
};

export type FocusPlan = {
  counts: FocusCounts;
  /** The whole order, the next task first. Held tasks are never in it. */
  queue: AssignedTask[];
  next: AssignedTask | null;
  reason: Reason | null;
  overdue: AssignedTask[];
  today: AssignedTask[];
  thisWeek: AssignedTask[];
  later: AssignedTask[];
  held: AssignedTask[];
  /** Most urgent blocker first. */
  people: WaitingPerson[];
  /** Open tasks due on each of the next seven days, starting today. */
  week: AssignedTask[][];
};

function groupPeople(blockers: readonly AssignedTask[]): WaitingPerson[] {
  const people = new Map<string | null, WaitingPerson>();
  for (const blocker of blockers) {
    for (const w of blocker.waiting) {
      const name = w.assigneeName ? firstName(w.assigneeName) : null;
      const person = people.get(name) ?? {
        name,
        fullName: w.assigneeName,
        stuck: [],
      };
      person.stuck.push({ key: w.key, title: w.title, blocker });
      people.set(name, person);
    }
  }
  return [...people.values()];
}

/**
 * Orders the open tasks into one queue. Tasks that wait on other work stay out
 * of it, because they cannot be finished. A pinned task jumps to the front;
 * skipped tasks go last.
 */
export function buildFocusPlan(
  tasks: readonly AssignedTask[],
  day: number,
  order: QueueOrder,
): FocusPlan {
  const isHeld = (task: AssignedTask) => finishBlock(task) === "held";
  const held = tasks.filter(isHeld).sort(byUrgency(day));
  const free = tasks.filter((t) => !isHeld(t)).sort(byUrgency(day));
  const queue = orderQueue(free, order);

  const next = queue[0] ?? null;
  const rest = queue.slice(1);
  const bucket = (pick: (days: number | null) => boolean) =>
    rest.filter((t) => pick(daysUntil(t, day)));
  const countDue = (pick: (days: number | null) => boolean) =>
    free.filter((t) => pick(daysUntil(t, day))).length;

  // Held blockers still hold people up, so they come after the queue.
  const people = groupPeople([...queue, ...held]);
  const ranked = next ? reasonFor(next, day) : null;
  const plain = ranked?.kind === "next" || ranked?.kind === "priority";

  return {
    counts: {
      overdue: countDue((d) => d !== null && d < 0),
      today: countDue((d) => d === 0),
      week: countDue((d) => d !== null && d >= 1 && d <= 7),
      held: held.length,
      waiting: people.filter((p) => p.name !== null).length,
    },
    queue,
    next,
    // A task the person put first has no ranking reason worth stating.
    reason:
      next && plain && pinnedId(order) === next.id
        ? { kind: "picked" }
        : ranked,
    overdue: bucket((d) => d !== null && d < 0),
    today: bucket((d) => d === 0),
    thisWeek: bucket((d) => d !== null && d >= 1 && d <= 7),
    later: bucket((d) => d === null || d > 7),
    held,
    people,
    week: Array.from({ length: 7 }, (_, i) =>
      tasks.filter((t) => daysUntil(t, day) === i),
    ),
  };
}

/** Open tasks per repo, the fullest first. */
export function repoLoad(
  tasks: readonly AssignedTask[],
): { id: string; name: string; count: number }[] {
  const byRepo = new Map<string, { id: string; name: string; count: number }>();
  for (const t of tasks) {
    const row = byRepo.get(t.projectId) ?? {
      id: t.projectId,
      name: t.projectName,
      count: 0,
    };
    row.count += 1;
    byRepo.set(t.projectId, row);
  }
  return [...byRepo.values()].sort(
    (a, b) => b.count - a.count || a.name.localeCompare(b.name),
  );
}

/** What the one sentence at the top of the page says. The words are chosen where it is shown. */
export type Headline =
  | { kind: "waiting"; count: number }
  | { kind: "overdue"; count: number }
  | { kind: "today"; count: number }
  | { kind: "nothingDue" }
  | { kind: "heldOnly" }
  | { kind: "clear" };

export function headline({ counts, next }: FocusPlan): Headline {
  if (counts.waiting > 0) return { kind: "waiting", count: counts.waiting };
  if (counts.overdue > 0) return { kind: "overdue", count: counts.overdue };
  if (counts.today > 0) return { kind: "today", count: counts.today };
  if (next) return { kind: "nothingDue" };
  if (counts.held > 0) return { kind: "heldOnly" };
  return { kind: "clear" };
}

/** The counts under the headline, skipping zeros. */
export function summaryParts({ counts }: FocusPlan): {
  count: number;
  part: "overdue" | "today" | "week" | "held";
}[] {
  return (["overdue", "today", "week", "held"] as const)
    .map((part) => ({ count: counts[part], part }))
    .filter(({ count }) => count > 0);
}
