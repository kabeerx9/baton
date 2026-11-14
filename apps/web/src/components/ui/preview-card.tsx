"use client";

import {
  HoverCard as HoverCardPrimitive,
  HoverCardContent as HoverCardContentPrimitive,
  HoverCardTrigger as HoverCardTriggerPrimitive,
} from "@ui-sdk/react/hover-card";
import * as React from "react";

import { cn } from "@/lib/cn";
import { POPUP_RESET } from "./popup-reset";

function HoverCard({
  closeDelay,
  openDelay,
  ...props
}: React.ComponentProps<typeof HoverCardPrimitive> & {
  openDelay?: number;
}) {
  return (
    <HoverCardPrimitive closeDelay={closeDelay} delay={openDelay} {...props} />
  );
}

function HoverCardTrigger({
  asChild = false,
  children,
  render,
  ...props
}: React.ComponentProps<typeof HoverCardTriggerPrimitive> & {
  asChild?: boolean;
}) {
  const resolvedRender = (
    asChild && React.isValidElement(children) ? children : render
  ) as React.ComponentProps<typeof HoverCardTriggerPrimitive>["render"];

  return (
    <HoverCardTriggerPrimitive render={resolvedRender} {...props}>
      {asChild ? undefined : children}
    </HoverCardTriggerPrimitive>
  );
}

function HoverCardContent({
  align = "center",
  children,
  className,
  side = "top",
  sideOffset = 4,
  ...props
}: React.ComponentProps<typeof HoverCardContentPrimitive>) {
  return (
    <HoverCardContentPrimitive
      align={align}
      className={cn(
        POPUP_RESET,
        "relative flex w-64 origin-(--transform-origin) text-balance rounded-lg border bg-popover not-dark:bg-clip-padding p-4 text-popover-foreground text-sm shadow-lg/5 transition-[scale,opacity] duration-150 ease-out before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-lg)-1px)] before:shadow-[0_1px_--theme(--color-black/4%)] data-ending-style:scale-98 data-starting-style:scale-98 data-ending-style:opacity-0 data-starting-style:opacity-0 dark:before:shadow-[0_-1px_--theme(--color-white/6%)]",
        className,
      )}
      side={side}
      sideOffset={sideOffset}
      {...props}
    >
      {children}
    </HoverCardContentPrimitive>
  );
}

export { HoverCard, HoverCardContent, HoverCardTrigger };
