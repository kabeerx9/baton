"use client";

import {
  mergeProps,
  renderElement,
  type PartProps,
} from "@ui-sdk/react/primitive";

import { cn } from "@/lib/cn";

// These wrappers take plain class strings: no call site passes a state function.
type DivProps = Omit<PartProps<"div">, "className"> & { className?: string };

function Card({ className, render, ...props }: DivProps) {
  const defaultProps = {
    className: cn(
      "relative flex flex-col rounded-2xl border bg-card not-dark:bg-clip-padding text-card-foreground shadow-xs/5 before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-2xl)-1px)] before:shadow-[0_1px_--theme(--color-black/4%)] dark:before:shadow-[0_-1px_--theme(--color-white/6%)]",
      className,
    ),
    "data-slot": "card",
  };

  return renderElement("div", mergeProps(defaultProps, props), render);
}

function CardHeader({ className, render, ...props }: DivProps) {
  const defaultProps = {
    className: cn(
      "grid auto-rows-min grid-rows-[auto_auto] items-start gap-1.5 p-6 in-[[data-slot=card]:has(>[data-slot=card-panel])]:pb-4 sm:has-data-[slot=card-action]:grid-cols-[1fr_auto]",
      className,
    ),
    "data-slot": "card-header",
  };

  return renderElement("div", mergeProps(defaultProps, props), render);
}

function CardTitle({ className, render, ...props }: DivProps) {
  const defaultProps = {
    className: cn("font-semibold text-lg leading-none", className),
    "data-slot": "card-title",
  };

  return renderElement("div", mergeProps(defaultProps, props), render);
}

function CardDescription({ className, render, ...props }: DivProps) {
  const defaultProps = {
    className: cn("text-muted-foreground text-sm", className),
    "data-slot": "card-description",
  };

  return renderElement("div", mergeProps(defaultProps, props), render);
}

function CardContent({ className, render, ...props }: DivProps) {
  const defaultProps = {
    className: cn(
      "flex-1 p-6 in-[[data-slot=card]:has(>[data-slot=card-header]:not(.border-b))]:pt-0 in-[[data-slot=card]:has(>[data-slot=card-footer]:not(.border-t))]:pb-0",
      className,
    ),
    "data-slot": "card-panel",
  };

  return renderElement("div", mergeProps(defaultProps, props), render);
}

export { Card, CardContent, CardDescription, CardHeader, CardTitle };
