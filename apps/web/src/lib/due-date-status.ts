export type DueDateStatus =
  | "overdue"
  | "due-soon"
  | "far-future"
  | "no-due-date";

type CompletionColumn = { slug: string; isFinal: boolean };

// Columns are user-configurable, so completion comes from the column's isFinal
// flag. The slug check is the fallback for surfaces that render before columns
// load, or that never have them.
export function isTaskCompleted(
  status: string,
  columns?: CompletionColumn[],
): boolean {
  if (columns?.length) {
    return columns.find((column) => column.slug === status)?.isFinal ?? false;
  }
  return status === "done" || status === "archived";
}

export function getDueDateStatus(
  dueDate: string | null,
  isCompleted = false,
): DueDateStatus {
  if (!dueDate) return "no-due-date";
  // A finished task cannot be late, so it keeps the neutral badge.
  if (isCompleted) return "far-future";

  const now = new Date();
  const due = new Date(dueDate);
  const diffInDays = Math.ceil(
    (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (diffInDays < 0) return "overdue";
  if (diffInDays <= 3) return "due-soon";
  return "far-future";
}
