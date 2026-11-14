"use client";

import {
  Progress as ProgressPrimitive,
  ProgressIndicator as ProgressIndicatorPrimitive,
  ProgressTrack as ProgressTrackPrimitive,
} from "@ui-sdk/react/progress";
import type { ComponentProps } from "react";

import { cn } from "@/lib/cn";

function ProgressTrack({
  className,
  ...props
}: ComponentProps<typeof ProgressTrackPrimitive>) {
  return (
    <ProgressTrackPrimitive
      className={cn(
        "block h-1.5 w-full overflow-hidden rounded-full bg-input",
        className,
      )}
      {...props}
    />
  );
}

function ProgressIndicator({
  className,
  ...props
}: ComponentProps<typeof ProgressIndicatorPrimitive>) {
  return (
    <ProgressIndicatorPrimitive
      className={cn(
        // UI SDK positions the indicator with an inline width only. Base UI also
        // set `height: inherit`, so the fill needs its own height here.
        "h-full bg-primary transition-[width] duration-300 ease-linear",
        className,
      )}
      {...props}
    />
  );
}

function Progress({
  className,
  children,
  ...props
}: ComponentProps<typeof ProgressPrimitive>) {
  return (
    <ProgressPrimitive
      className={cn("flex w-full flex-col gap-2", className)}
      {...props}
    >
      {children ? (
        children
      ) : (
        <ProgressTrack>
          <ProgressIndicator />
        </ProgressTrack>
      )}
    </ProgressPrimitive>
  );
}

export { Progress };
