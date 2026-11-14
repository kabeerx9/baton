"use client";

import {
  Tooltip as TooltipPrimitive,
  TooltipContent as TooltipContentPrimitive,
  TooltipTrigger as TooltipTriggerPrimitive,
} from "@ui-sdk/react/tooltip";
import * as React from "react";

import { cn } from "@/lib/cn";
import { POPUP_RESET } from "./popup-reset";

const Tooltip = TooltipPrimitive;

/**
 * UI SDK groups tooltips without a provider. Baton keeps this export because
 * call sites still wrap tooltips in it.
 */
function TooltipProvider({ children }: { children?: React.ReactNode }) {
  return <>{children}</>;
}

function TooltipTrigger({
  asChild = false,
  children,
  render,
  ...props
}: React.ComponentProps<typeof TooltipTriggerPrimitive> & {
  asChild?: boolean;
}) {
  const resolvedRender =
    asChild && React.isValidElement<Record<string, any>>(children)
      ? children
      : render;

  return (
    <TooltipTriggerPrimitive render={resolvedRender} {...props}>
      {asChild ? undefined : children}
    </TooltipTriggerPrimitive>
  );
}

function TooltipPopup({
  className,
  align = "center",
  hidden,
  sideOffset = 4,
  side = "top",
  children,
  ...props
}: React.ComponentProps<typeof TooltipContentPrimitive>) {
  // UI SDK owns the content's `hidden` attribute and would overwrite it, so a
  // caller asking for no tooltip (the sidebar while expanded) gets no popup.
  if (hidden) {
    return null;
  }

  return (
    <TooltipContentPrimitive
      align={align}
      className={cn(
        POPUP_RESET,
        "relative flex max-w-(--available-width) origin-(--transform-origin) text-balance rounded-md border bg-popover not-dark:bg-clip-padding px-2 py-1 text-popover-foreground text-xs shadow-md/5 transition-[scale,opacity] duration-150 ease-out before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-md)-1px)] before:shadow-[0_1px_--theme(--color-black/4%)] data-ending-style:scale-98 data-starting-style:scale-98 data-ending-style:opacity-0 data-starting-style:opacity-0 dark:before:shadow-[0_-1px_--theme(--color-white/6%)]",
        className,
      )}
      side={side}
      sideOffset={sideOffset}
      {...props}
    >
      {children}
    </TooltipContentPrimitive>
  );
}

export {
  Tooltip,
  TooltipPopup,
  TooltipPopup as TooltipContent,
  TooltipProvider,
  TooltipTrigger,
};
