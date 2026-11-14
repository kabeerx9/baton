"use client";

import { CheckboxGroup as CheckboxGroupRoot } from "@ui-sdk/react/checkbox";
import type * as React from "react";

import { cn } from "@/lib/cn";

type CheckboxGroupProps = Omit<
  React.ComponentProps<typeof CheckboxGroupRoot>,
  "className"
> & {
  className?: string;
};

function CheckboxGroup({ className, ...props }: CheckboxGroupProps) {
  return (
    <CheckboxGroupRoot
      className={cn("flex flex-col items-start gap-3", className)}
      {...props}
    />
  );
}

export { CheckboxGroup };
