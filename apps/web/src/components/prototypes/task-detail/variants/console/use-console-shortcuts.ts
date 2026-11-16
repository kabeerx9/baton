import type { PageProps } from "../../page-props";
import { useShortcut } from "@/components/ui/shortcuts";
import { nextActionControl } from "../../shared/use-next-action";
import { nextPriority } from "./cycle";

/**
 * Plain letters only, so they never meet the picker's digits, arrows and R.
 * UI SDK ignores them while someone types in a field.
 */
export function useConsoleShortcuts(
  { task, view, viewer, dispatch }: PageProps,
  actions: { openPalette: () => void; focusComment: () => void },
) {
  const control = nextActionControl({ view, viewer, dispatch });
  useShortcut("mod+k", actions.openPalette, { description: "Command bar" });
  useShortcut("s", () => control.run?.(), { description: "Advance status" });
  useShortcut(
    "p",
    () =>
      dispatch({ type: "set-priority", priority: nextPriority(task.priority) }),
    { description: "Cycle priority" },
  );
  useShortcut(
    "a",
    () =>
      dispatch({
        type: "assign",
        person: task.assignee?.id === viewer.person.id ? null : viewer.person,
        viewer,
      }),
    { description: "Take or release" },
  );
  useShortcut("c", actions.focusComment, { description: "Comment" });
}
