"use client";

import {
  ScrollArea as ScrollAreaPrimitive,
  ScrollAreaContent,
  ScrollAreaCorner,
  ScrollAreaScrollbar,
  ScrollAreaThumb,
  ScrollAreaViewport,
} from "@ui-sdk/react/scroll-area";
import * as React from "react";

import { cn } from "@/lib/cn";

function ScrollArea({
  className,
  children,
  scrollFade = false,
  scrollbarGutter = false,
  viewportProps,
  ...props
}: Omit<
  React.ComponentProps<typeof ScrollAreaPrimitive>,
  "className" | "children"
> & {
  className?: string;
  children?: React.ReactNode;
  scrollFade?: boolean;
  scrollbarGutter?: boolean;
  /** Attributes for the scrolling viewport, such as a scroll-restoration id. */
  viewportProps?: React.ComponentProps<typeof ScrollAreaViewport> & {
    [key: `data-${string}`]: string | undefined;
  };
}) {
  return (
    <ScrollAreaPrimitive
      className={cn("size-full min-h-0", className)}
      // The scrollbar classes fade out 300ms after the pointer leaves. UI SDK's
      // own 600ms hide delay would stack on top of that.
      scrollHideDelay={0}
      {...props}
    >
      {/* Intentional: UI SDK drops the viewport's tab stop when it holds focusable content. */}
      <ScrollAreaViewport
        {...viewportProps}
        className={cn(
          "h-full overscroll-y-contain rounded-[inherit] outline-none transition-shadows focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background data-overflow-x:overscroll-x-contain",
          scrollFade &&
            "mask-t-from-[calc(100%-min(var(--fade-size),var(--scroll-area-overflow-y-start)))] mask-b-from-[calc(100%-min(var(--fade-size),var(--scroll-area-overflow-y-end)))] mask-l-from-[calc(100%-min(var(--fade-size),var(--scroll-area-overflow-x-start)))] mask-r-from-[calc(100%-min(var(--fade-size),var(--scroll-area-overflow-x-end)))] [--fade-size:1.5rem] [--scroll-area-overflow-x-end:inherit] [--scroll-area-overflow-x-start:inherit] [--scroll-area-overflow-y-end:inherit] [--scroll-area-overflow-y-start:inherit]",
          scrollbarGutter && "data-overflow-y:pe-2.5 data-overflow-x:pb-2.5",
          viewportProps?.className,
        )}
      >
        <ScrollAreaContent>{children}</ScrollAreaContent>
      </ScrollAreaViewport>
      <ScrollBar orientation="vertical" />
      <ScrollBar orientation="horizontal" />
      <ScrollAreaCorner />
    </ScrollAreaPrimitive>
  );
}

function ScrollBar({
  className,
  orientation = "vertical",
  ...props
}: React.ComponentProps<typeof ScrollAreaScrollbar>) {
  return (
    <ScrollAreaScrollbar
      className={cn(
        "m-1 flex opacity-0 transition-opacity delay-300 data-[orientation=horizontal]:h-1.5 data-[orientation=vertical]:w-1.5 data-[orientation=horizontal]:flex-col data-visible:opacity-100 data-visible:delay-0 data-visible:duration-100",
        className,
      )}
      orientation={orientation}
      {...props}
    >
      <ScrollAreaThumb className="relative flex-1 rounded-full bg-foreground/20" />
    </ScrollAreaScrollbar>
  );
}

export { ScrollArea };
