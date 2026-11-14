"use client";

import {
  Checkbox as CheckboxRoot,
  CheckboxIndicator,
} from "@ui-sdk/react/checkbox";
import type * as React from "react";

import { cn } from "@/lib/cn";

type RootProps = React.ComponentProps<typeof CheckboxRoot>;
type CheckedChange = NonNullable<RootProps["onCheckedChange"]>;

type CheckboxProps = Omit<
  RootProps,
  "checked" | "defaultChecked" | "onCheckedChange" | "className"
> & {
  className?: string;
  checked?: boolean;
  defaultChecked?: boolean;
  indeterminate?: boolean;
  /**
   * Baton callers only deal in the two settled states, so a mixed checkbox
   * reports `false`, as Base UI did.
   */
  onCheckedChange?: (
    checked: boolean,
    details: Parameters<CheckedChange>[1],
  ) => void;
};

function Checkbox({
  checked,
  className,
  defaultChecked,
  indeterminate,
  onCheckedChange,
  ...props
}: CheckboxProps) {
  return (
    <CheckboxRoot
      checked={indeterminate ? "indeterminate" : checked}
      className={cn(
        "relative inline-flex size-4.5 shrink-0 items-center justify-center rounded-[.25rem] border border-input bg-background not-dark:bg-clip-padding shadow-xs/5 outline-none ring-ring transition-shadow before:pointer-events-none before:absolute before:inset-0 before:rounded-[3px] not-data-disabled:not-data-checked:not-aria-invalid:before:shadow-[0_1px_--theme(--color-black/4%)] focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-offset-background aria-invalid:border-destructive/36 focus-visible:aria-invalid:border-destructive/64 focus-visible:aria-invalid:ring-destructive/48 data-disabled:opacity-64 sm:size-4 dark:not-data-checked:bg-input/32 dark:aria-invalid:ring-destructive/24 dark:not-data-disabled:not-data-checked:not-aria-invalid:before:shadow-[0_-1px_--theme(--color-white/6%)] [[data-disabled],[data-checked],[aria-invalid]]:shadow-none",
        className,
      )}
      defaultChecked={indeterminate ? "indeterminate" : defaultChecked}
      onCheckedChange={(next, details) =>
        onCheckedChange?.(next === true, details)
      }
      {...props}
    >
      <CheckboxIndicator
        className="-inset-px absolute flex items-center justify-center rounded-[.25rem] text-primary-foreground transition-[opacity,scale] duration-150 ease-out data-unchecked:pointer-events-none data-unchecked:scale-90 data-unchecked:opacity-0 data-checked:bg-primary data-indeterminate:text-foreground motion-reduce:transition-[opacity] motion-reduce:data-unchecked:scale-100"
        keepMounted
      >
        {(state) =>
          state.indeterminate ? (
            <svg
              aria-hidden="true"
              className="size-3.5 sm:size-3"
              fill="none"
              height="24"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="3"
              viewBox="0 0 24 24"
              width="24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M5.252 12h13.496" />
            </svg>
          ) : (
            <svg
              aria-hidden="true"
              className="size-3.5 sm:size-3"
              fill="none"
              height="24"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="3"
              viewBox="0 0 24 24"
              width="24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M5.252 12.7 10.2 18.63 18.748 5.37" />
            </svg>
          )
        }
      </CheckboxIndicator>
    </CheckboxRoot>
  );
}

export { Checkbox };
