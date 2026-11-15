"use client";

import {
  NumberInput,
  NumberInputControl,
  NumberInputDecrement,
  NumberInputGroup,
  NumberInputIncrement,
  NumberInputScrubArea,
  NumberInputScrubAreaCursor,
} from "@ui-sdk/react/number-input";
import { MinusIcon, PlusIcon } from "lucide-react";
import * as React from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/cn";

// These wrappers take a plain class string: no call site passes a state function.
type WithClassName<T> = Omit<T, "className"> & { className?: string };

// The id names the input, as Base UI's Root did: UI SDK's root is a wrapper
// element, so the id goes to the input and the scrub area label points at it.
const NumberFieldContext = React.createContext<{
  fieldId: string;
} | null>(null);

function NumberField({
  id,
  className,
  size = "default",
  ...props
}: WithClassName<Omit<React.ComponentProps<typeof NumberInput>, "id">> & {
  id?: string;
  size?: "sm" | "default" | "lg";
}) {
  const generatedId = React.useId();
  const fieldId = id ?? generatedId;

  return (
    <NumberFieldContext.Provider value={{ fieldId }}>
      <NumberInput
        className={cn("flex w-full flex-col items-start gap-2", className)}
        data-size={size}
        {...props}
      />
    </NumberFieldContext.Provider>
  );
}

function NumberFieldGroup({
  className,
  ...props
}: WithClassName<React.ComponentProps<typeof NumberInputGroup>>) {
  return (
    <NumberInputGroup
      className={cn(
        "relative flex w-full justify-between rounded-lg border border-input bg-background not-dark:bg-clip-padding text-base text-foreground shadow-xs/5 ring-ring/24 transition-shadow before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-lg)-1px)] not-data-disabled:not-focus-within:not-aria-invalid:before:shadow-[0_1px_--theme(--color-black/4%)] focus-within:border-ring focus-within:ring-[3px] has-aria-invalid:border-destructive/36 has-autofill:bg-foreground/4 focus-within:has-aria-invalid:border-destructive/64 focus-within:has-aria-invalid:ring-destructive/48 data-disabled:pointer-events-none data-disabled:opacity-64 sm:text-sm dark:bg-input/32 dark:has-autofill:bg-foreground/8 dark:has-aria-invalid:ring-destructive/24 dark:not-data-disabled:not-focus-within:not-aria-invalid:before:shadow-[0_-1px_--theme(--color-white/6%)] [&_svg:not([class*='size-'])]:size-4.5 sm:[&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0 [[data-disabled],:focus-within,[aria-invalid]]:shadow-none",
        className,
      )}
      {...props}
    />
  );
}

function NumberFieldDecrement({
  className,
  ...props
}: WithClassName<React.ComponentProps<typeof NumberInputDecrement>>) {
  return (
    <NumberInputDecrement
      className={cn(
        "relative flex shrink-0 cursor-pointer items-center justify-center rounded-s-[calc(var(--radius-lg)-1px)] in-data-[size=sm]:px-[calc(--spacing(2.5)-1px)] px-[calc(--spacing(3)-1px)] transition-colors pointer-coarse:after:absolute pointer-coarse:after:size-full pointer-coarse:after:min-h-11 pointer-coarse:after:min-w-11 hover:bg-accent",
        className,
      )}
      {...props}
    >
      <MinusIcon />
    </NumberInputDecrement>
  );
}

function NumberFieldIncrement({
  className,
  ...props
}: WithClassName<React.ComponentProps<typeof NumberInputIncrement>>) {
  return (
    <NumberInputIncrement
      className={cn(
        "relative flex shrink-0 cursor-pointer items-center justify-center rounded-e-[calc(var(--radius-lg)-1px)] in-data-[size=sm]:px-[calc(--spacing(2.5)-1px)] px-[calc(--spacing(3)-1px)] transition-colors pointer-coarse:after:absolute pointer-coarse:after:size-full pointer-coarse:after:min-h-11 pointer-coarse:after:min-w-11 hover:bg-accent",
        className,
      )}
      {...props}
    >
      <PlusIcon />
    </NumberInputIncrement>
  );
}

function NumberFieldInput({
  className,
  id,
  ...props
}: WithClassName<React.ComponentProps<typeof NumberInputControl>>) {
  const context = React.useContext(NumberFieldContext);

  return (
    <NumberInputControl
      className={cn(
        "h-8.5 in-data-[size=lg]:h-9.5 in-data-[size=sm]:h-7.5 w-full min-w-0 grow bg-transparent in-data-[size=sm]:px-[calc(--spacing(2.5)-1px)] px-[calc(--spacing(3)-1px)] text-center tabular-nums in-data-[size=lg]:leading-9.5 in-data-[size=sm]:leading-7.5 leading-8.5 outline-none [transition:background-color_5000000s_ease-in-out_0s] sm:h-7.5 sm:in-data-[size=lg]:h-8.5 sm:in-data-[size=sm]:h-6.5 sm:in-data-[size=lg]:leading-8.5 sm:in-data-[size=sm]:leading-8.5 sm:leading-7.5",
        className,
      )}
      id={id ?? context?.fieldId}
      {...props}
    />
  );
}

function NumberFieldScrubArea({
  className,
  label,
  ...props
}: WithClassName<React.ComponentProps<typeof NumberInputScrubArea>> & {
  label: string;
}) {
  const context = React.useContext(NumberFieldContext);

  if (!context) {
    throw new Error(
      "NumberFieldScrubArea must be used within a NumberField component for accessibility.",
    );
  }

  return (
    <NumberInputScrubArea
      className={cn("flex cursor-ew-resize", className)}
      {...props}
    >
      <Label className="cursor-ew-resize" htmlFor={context.fieldId}>
        {label}
      </Label>
      <NumberInputScrubAreaCursor className="drop-shadow-[0_1px_1px_#0008] filter">
        <CursorGrowIcon />
      </NumberInputScrubAreaCursor>
    </NumberInputScrubArea>
  );
}

function CursorGrowIcon(props: React.ComponentProps<"svg">) {
  return (
    <svg
      aria-hidden="true"
      fill="black"
      height="14"
      stroke="white"
      viewBox="0 0 24 14"
      width="26"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path d="M19.5 5.5L6.49737 5.51844V2L1 6.9999L6.5 12L6.49737 8.5L19.5 8.5V12L25 6.9999L19.5 2V5.5Z" />
    </svg>
  );
}

export {
  NumberField,
  NumberFieldDecrement,
  NumberFieldGroup,
  NumberFieldIncrement,
  NumberFieldInput,
  NumberFieldScrubArea,
};
