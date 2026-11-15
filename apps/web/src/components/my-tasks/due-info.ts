import { differenceInCalendarDays } from "date-fns";

/** How a due date reads on this page. The words are chosen where it is shown. */
export type DueInfo =
  | { kind: "none" }
  | { kind: "overdue"; days: number }
  | { kind: "today" }
  | { kind: "tomorrow" }
  /** Two to six days away: a weekday says it best. */
  | { kind: "weekday"; date: Date }
  | { kind: "date"; date: Date };

/** Calendar math in the viewer's timezone, like the rest of the app's due dates. */
export function describeDue(dueDate: string | null, day: number): DueInfo {
  if (!dueDate) return { kind: "none" };
  const date = new Date(dueDate);
  const days = differenceInCalendarDays(date, new Date(day));
  if (days < 0) return { kind: "overdue", days: -days };
  if (days === 0) return { kind: "today" };
  if (days === 1) return { kind: "tomorrow" };
  if (days <= 6) return { kind: "weekday", date };
  return { kind: "date", date };
}
