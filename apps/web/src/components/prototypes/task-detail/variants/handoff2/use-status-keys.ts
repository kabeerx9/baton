import { useShortcut } from "@/components/ui/shortcuts";
import type { PageProps } from "../../page-props";
import { OPEN_MENU_KEY, STATUS_KEY } from "./status-keys";

/** One key per status, and S to open the menu where there is one. */
export function useStatusKeys(
  { viewer, dispatch }: Pick<PageProps, "viewer" | "dispatch">,
  openMenu?: () => void,
) {
  useShortcut(
    STATUS_KEY.todo,
    () => dispatch({ type: "set-status", to: "todo", viewer }),
    { description: "To do" },
  );
  useShortcut(
    STATUS_KEY.doing,
    () => dispatch({ type: "set-status", to: "doing", viewer }),
    { description: "In progress" },
  );
  useShortcut(
    STATUS_KEY.review,
    () => dispatch({ type: "set-status", to: "review", viewer }),
    { description: "In review" },
  );
  useShortcut(
    STATUS_KEY.done,
    () => dispatch({ type: "set-status", to: "done", viewer }),
    { description: "Done" },
  );
  useShortcut(OPEN_MENU_KEY, () => openMenu?.(), {
    description: "Change status",
  });
}
