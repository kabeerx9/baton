import type { RefObject } from "react";
import { useShortcut } from "@/lib/shortcuts/use-shortcut";
import { focusedTaskId, focusNeighbour, moveRowFocus } from "./row-nav";

/**
 * The page's keys. They are registered for the view, so a popup or a text
 * field keeps its own keys. `rows` is the element that holds the task rows.
 */
export function useMyTasksShortcuts({
  rows,
  hasNext,
  canUndo,
  onFinishNext,
  onSkipNext,
  canFinishRow,
  onFinishRow,
  onUndo,
}: {
  rows: RefObject<HTMLElement | null>;
  hasNext: boolean;
  canUndo: boolean;
  onFinishNext: () => void;
  onSkipNext: () => void;
  /** False for a row that cannot be finished: focus then stays on it. */
  canFinishRow: (taskId: string) => boolean;
  onFinishRow: (taskId: string) => void;
  onUndo: () => void;
}) {
  const view = { scope: "view" } as const;
  useShortcut("finishNextTask", onFinishNext, { ...view, enabled: hasNext });
  useShortcut("skipNextTask", onSkipNext, { ...view, enabled: hasNext });
  useShortcut("undoFinish", onUndo, { ...view, enabled: canUndo });
  useShortcut("nextTask", () => moveRowFocus(rows.current, 1), view);
  useShortcut("previousTask", () => moveRowFocus(rows.current, -1), view);
  useShortcut(
    "finishFocusedTask",
    () => {
      const id = focusedTaskId(rows.current);
      if (!id || !canFinishRow(id)) return;
      // The row is about to leave: keep focus in the list.
      focusNeighbour(rows.current);
      onFinishRow(id);
    },
    view,
  );
}
