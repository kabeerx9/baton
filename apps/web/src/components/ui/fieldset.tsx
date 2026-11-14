"use client";

import { FieldLegend, FieldSet } from "@ui-sdk/react/field";
import type * as React from "react";

import { cn } from "@/lib/cn";

type WithClassName<T> = Omit<T, "className"> & { className?: string };

function Fieldset({
  className,
  ...props
}: WithClassName<React.ComponentProps<typeof FieldSet>>) {
  return (
    <FieldSet
      className={cn("flex w-full max-w-64 flex-col gap-6", className)}
      {...props}
    />
  );
}

function FieldsetLegend({
  className,
  ...props
}: WithClassName<React.ComponentProps<typeof FieldLegend>>) {
  return (
    <FieldLegend
      className={cn("font-semibold text-foreground", className)}
      {...props}
    />
  );
}

export { Fieldset, FieldsetLegend };
