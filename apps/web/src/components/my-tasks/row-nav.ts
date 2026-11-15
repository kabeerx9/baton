const ROW = "[data-row-focus]";

function rowsIn(scope: HTMLElement | null): HTMLElement[] {
  return scope ? [...scope.querySelectorAll<HTMLElement>(ROW)] : [];
}

/** Where focus goes from `current` after `step` rows. It stops at both ends. */
export function nextIndex(current: number, step: number, count: number) {
  if (count === 0) return -1;
  if (current < 0) return step > 0 ? 0 : count - 1;
  return Math.min(count - 1, Math.max(0, current + step));
}

/** Moves focus `step` rows inside `scope`. A row opts in with `data-row-focus`. */
export function moveRowFocus(scope: HTMLElement | null, step: number) {
  const rows = rowsIn(scope);
  const at = rows.findIndex((row) => row === document.activeElement);
  rows[nextIndex(at, step, rows.length)]?.focus();
}

/** The id of the task whose row has focus, or null. The row carries `data-task-id`. */
export function focusedTaskId(scope: HTMLElement | null): string | null {
  const active = document.activeElement;
  if (!(active instanceof HTMLElement) || !scope?.contains(active)) return null;
  if (!active.matches(ROW)) return null;
  return active.closest<HTMLElement>("[data-task-id]")?.dataset.taskId ?? null;
}

/** Moves focus off a row that is about to leave: to the next row, else the one before. */
export function focusNeighbour(scope: HTMLElement | null) {
  const rows = rowsIn(scope);
  const at = rows.findIndex((row) => row === document.activeElement);
  if (at >= 0) (rows[at + 1] ?? rows[at - 1])?.focus();
}
