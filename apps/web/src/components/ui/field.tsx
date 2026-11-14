"use client";

import {
  Field as FieldRoot,
  FieldDescription as FieldDescriptionPart,
  FieldError as FieldErrorPart,
  FieldLabel as FieldLabelPart,
} from "@ui-sdk/react/field";
import type * as React from "react";

import { cn } from "@/lib/cn";

// These wrappers take a plain class string: no call site passes a state function.
type WithClassName<T> = Omit<T, "className"> & { className?: string };

// UI SDK marks a radio group or checkbox group invalid, not each radio or
// checkbox inside it, and the Radio and Checkbox wrappers color their error
// state from their own aria-invalid. So an invalid field paints them itself.
// Tailwind reads these as whole strings, so each class is written out.
const GROUPED_CONTROL_ERROR =
  "data-invalid:**:data-[slot=radio]:border-destructive/36 data-invalid:**:data-[slot=radio]:focus-visible:border-destructive/64 data-invalid:**:data-[slot=radio]:focus-visible:ring-destructive/48 data-invalid:**:data-[slot=checkbox]:border-destructive/36 data-invalid:**:data-[slot=checkbox]:focus-visible:border-destructive/64 data-invalid:**:data-[slot=checkbox]:focus-visible:ring-destructive/48";

function Field({
  className,
  ...props
}: WithClassName<React.ComponentProps<typeof FieldRoot>>) {
  return (
    <FieldRoot
      className={cn(
        "flex flex-col items-start gap-2",
        GROUPED_CONTROL_ERROR,
        className,
      )}
      {...props}
    />
  );
}

function FieldLabel({
  className,
  ...props
}: WithClassName<React.ComponentProps<typeof FieldLabelPart>>) {
  return (
    <FieldLabelPart
      className={cn(
        "inline-flex items-center gap-2 font-medium text-base/4.5 text-foreground sm:text-sm/4",
        className,
      )}
      {...props}
    />
  );
}

function FieldDescription({
  className,
  ...props
}: WithClassName<React.ComponentProps<typeof FieldDescriptionPart>>) {
  return (
    <FieldDescriptionPart
      className={cn("text-muted-foreground text-xs", className)}
      {...props}
    />
  );
}

function FieldError({
  className,
  ...props
}: WithClassName<React.ComponentProps<typeof FieldErrorPart>>) {
  return (
    <FieldErrorPart
      className={cn("text-destructive-foreground text-xs", className)}
      {...props}
    />
  );
}

export { Field, FieldDescription, FieldError, FieldLabel };
