"use client";

import type { PartProps } from "@ui-sdk/react/primitive";
import {
  Radio as RadioPrimitive,
  RadioGroup as RadioGroupPrimitive,
  RadioIndicator,
  type RadioGroupOptions,
  type RadioGroupState,
} from "@ui-sdk/react/radio";
import type * as React from "react";

import { cn } from "@/lib/cn";

type RadioGroupProps<T extends string = string> = RadioGroupOptions<T> &
  Omit<
    PartProps<"div", RadioGroupState>,
    "className" | "defaultValue" | "onChange" | "onSelect"
  > & { className?: string };

function RadioGroup<T extends string = string>({
  className,
  ...props
}: RadioGroupProps<T>) {
  return (
    <RadioGroupPrimitive
      className={cn("flex flex-col gap-3", className)}
      {...props}
    />
  );
}

type RadioProps = Omit<
  React.ComponentProps<typeof RadioPrimitive>,
  "className"
> & {
  className?: string;
};

function Radio({ className, ...props }: RadioProps) {
  return (
    <RadioPrimitive
      className={cn(
        "relative inline-flex size-4.5 shrink-0 items-center justify-center rounded-full border border-input bg-background not-dark:bg-clip-padding shadow-xs/5 outline-none transition-shadow before:pointer-events-none before:absolute before:inset-0 before:rounded-full not-data-disabled:not-data-checked:not-aria-invalid:before:shadow-[0_1px_--theme(--color-black/4%)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background aria-invalid:border-destructive/36 focus-visible:aria-invalid:border-destructive/64 focus-visible:aria-invalid:ring-destructive/48 data-disabled:opacity-64 sm:size-4 dark:not-data-checked:bg-input/32 dark:aria-invalid:ring-destructive/24 dark:not-data-disabled:not-data-checked:not-aria-invalid:before:shadow-[0_-1px_--theme(--color-white/6%)] [[data-disabled],[data-checked],[aria-invalid]]:shadow-none",
        className,
      )}
      {...props}
    >
      <RadioIndicator className="-inset-px absolute flex size-4.5 items-center justify-center rounded-full before:size-2 before:rounded-full before:bg-primary-foreground data-unchecked:hidden data-checked:bg-primary sm:size-4 sm:before:size-1.5" />
    </RadioPrimitive>
  );
}

export { Radio, RadioGroup, RadioPrimitive };
