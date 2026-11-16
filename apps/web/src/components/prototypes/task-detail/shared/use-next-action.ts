import type { TaskView } from "../derive";
import { nextLabel } from "../copy";
import type { PageProps } from "../page-props";

export type NextActionControl = {
  label: string | null;
  /** The action can run now. A wait or an answer does not use `run`. */
  run: (() => void) | null;
};

/** Turns the derived next action into one button's label and click. */
export function nextActionControl({
  view,
  viewer,
  dispatch,
}: Pick<PageProps, "view" | "viewer" | "dispatch">): NextActionControl {
  const { next } = view;
  const label = nextLabel(view as TaskView);
  switch (next.kind) {
    case "move":
      return {
        label,
        run: () => dispatch({ type: "set-status", to: next.to, viewer }),
      };
    case "assign":
      return {
        label,
        run: () => dispatch({ type: "assign", person: viewer.person, viewer }),
      };
    default:
      return { label, run: null };
  }
}
