"use client";

import {
  mergeProps,
  renderElement,
  type PartProps,
} from "@ui-sdk/react/primitive";

import { cn } from "@/lib/cn";

// This wrapper takes a plain class string: no call site passes a state function.
interface LabelProps extends Omit<PartProps<"label">, "className"> {
  className?: string;
}

function Label({ className, render, ...props }: LabelProps) {
  const defaultProps = {
    className: cn(
      "inline-flex items-center gap-2 text-base/4.5 sm:text-sm/4 font-medium text-foreground",
      className,
    ),
    "data-slot": "label",
  };

  return renderElement("label", mergeProps(defaultProps, props), render);
}

export { Label };
