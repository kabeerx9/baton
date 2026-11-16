"use client";

import {
  SegmentedControl as SegmentedControlRoot,
  SegmentedControlIndicator as SegmentedControlIndicatorPart,
  SegmentedControlItem as SegmentedControlItemPart,
} from "@ui-sdk/react/segmented-control";
import * as React from "react";
import { cn } from "@/lib/cn";

type RootProps = Omit<
  React.ComponentProps<typeof SegmentedControlRoot>,
  "className" | "onValueChange" | "children"
> & {
  children?: React.ReactNode;
  className?: string;
  /**
   * Runs when the user chooses a step by click, tap, Enter or Space. Arrow,
   * Home and End only move focus: a choice that writes to a server must not
   * fire once per key press.
   */
  onChoose?: (value: string) => void;
};

/**
 * A row of steps that act like a radio group with one tab stop. The checked
 * step is filled by a sliding indicator. Selection is manual: see `onChoose`.
 */
function SegmentedControl({
  className,
  onChoose,
  children,
  ...props
}: RootProps) {
  return (
    <SegmentedControlRoot
      data-slot="segmented-control"
      className={cn(
        "relative isolate flex w-full gap-1 rounded-xl border bg-muted/50 p-1",
        className,
      )}
      onValueChange={(next, details) => {
        if (details.reason !== "item-press") {
          details.cancel();
          return;
        }
        if (typeof next === "string") onChoose?.(next);
      }}
      {...props}
    >
      <SegmentedControlIndicatorPart
        data-slot="segmented-control-indicator"
        className="absolute top-(--segmented-control-indicator-top) left-(--segmented-control-indicator-left) -z-10 h-(--segmented-control-indicator-height) w-(--segmented-control-indicator-width) rounded-lg bg-foreground transition-[left,width] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none"
      />
      {children}
    </SegmentedControlRoot>
  );
}

function SegmentedControlItem({
  className,
  ...props
}: Omit<React.ComponentProps<typeof SegmentedControlItemPart>, "className"> & {
  className?: string;
}) {
  return (
    <SegmentedControlItemPart
      data-slot="segmented-control-item"
      className={cn(
        "relative flex h-10 min-w-0 flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg px-3 font-medium text-muted-foreground text-sm outline-none transition-[color,scale] duration-150 ease-out hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98] data-checked:text-background data-checked:hover:text-background aria-checked:text-background aria-checked:hover:text-background disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { SegmentedControl, SegmentedControlItem };
