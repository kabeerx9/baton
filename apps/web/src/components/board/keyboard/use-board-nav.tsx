import { announce } from "@ui-sdk/core";
import {
  type PartProps,
  type PrimitiveHandle,
  usePart,
  usePrimitive,
} from "@ui-sdk/react/primitive";
import { useLayoutEffect } from "react";
import { useShortcut } from "@/lib/shortcuts/use-shortcut";
import { boardNav, type FocusRecovered } from "./board-nav";

type BoardNavHandle = PrimitiveHandle<typeof boardNav>;

/**
 * Board keyboard navigation for one board. Render `BoardNavRoot` with the
 * returned handle around the columns; the cards use the `BoardNav` parts.
 */
export function useBoardNav({
  columns,
  order,
  describe,
}: {
  /** Every column, left to right. Keep the array the same between renders. */
  columns: string[];
  /** Changes when cards are added, removed or reordered. */
  order: string;
  /** Words for a focus move that no key press caused. Null says nothing. */
  describe: (details: FocusRecovered) => string | null;
}): BoardNavHandle {
  const nav = usePrimitive(boardNav, {
    columns,
    onFocusRecovered: (details) => {
      const text = describe(details);
      if (text) announce(text);
    },
  });
  const { api } = nav;

  // React moves a reordered card's element, and a moved element loses focus.
  useLayoutEffect(() => {
    api.keepCurrent();
  }, [api, order]);

  // j and k: down and up from a card; from anywhere else, enter the board.
  const step = (direction: "up" | "down") => (event: KeyboardEvent) => {
    if (api.step(direction, event.target) === "outside") api.focusCurrent();
  };
  useShortcut("nextTask", step("down"), { scope: "view" });
  useShortcut("previousTask", step("up"), { scope: "view" });

  return nav;
}

/** The element that holds the board's columns. */
export function BoardNavRoot({
  nav,
  ...props
}: { nav: BoardNavHandle } & PartProps<"div">) {
  return usePart(nav, "root", {}, props, "div");
}
