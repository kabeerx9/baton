"use client";

import {
  Combobox as ComboboxRoot,
  ComboboxChip as ComboboxChipPrimitive,
  ComboboxChipRemove as ComboboxChipRemovePrimitive,
  ComboboxChips as ComboboxChipsPrimitive,
  ComboboxClear as ComboboxClearPrimitive,
  ComboboxContent as ComboboxContentPrimitive,
  ComboboxEmpty as ComboboxEmptyPrimitive,
  ComboboxGroup as ComboboxGroupPrimitive,
  ComboboxGroupLabel as ComboboxGroupLabelPrimitive,
  ComboboxInput as ComboboxInputPrimitive,
  ComboboxItem as ComboboxItemPrimitive,
  ComboboxItemIndicator as ComboboxItemIndicatorPrimitive,
  ComboboxList as ComboboxListPrimitive,
  ComboboxSeparator as ComboboxSeparatorPrimitive,
  ComboboxStatus as ComboboxStatusPrimitive,
  ComboboxTrigger as ComboboxTriggerPrimitive,
  ComboboxValue as ComboboxValuePrimitive,
  type ComboboxProps as ComboboxRootProps,
} from "@ui-sdk/react/combobox";
import type { ChangeDetails } from "@ui-sdk/core";
import type { ComboboxValueChangeReason } from "@ui-sdk/core/combobox";
import { ChevronsUpDownIcon, XIcon } from "lucide-react";
import * as React from "react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/cn";
import { i18n } from "@/lib/i18n";
import { containPopupEvents } from "./popup-containment";
import { POPUP_RESET } from "./popup-reset";

/** Base UI's names for props UI SDK renamed (record section 4, rule 3). */
type LegacyNames<Value> = {
  /** UI SDK name: `itemToLabel`. */
  itemToStringLabel?: (value: Value) => string;
  /** UI SDK name: `itemToValue`. */
  itemToStringValue?: (value: Value) => string;
  /** UI SDK name: `onQueryChange`. */
  onInputValueChange?: (value: string, details: { reason: string }) => void;
  /** UI SDK name: `query`. */
  inputValue?: string;
  /** UI SDK name: `defaultQuery`. */
  defaultInputValue?: string;
};

type Selection<Value, Multiple> = [Multiple] extends [true]
  ? Value[]
  : Value | null;

type ComboboxProps<Value, Multiple extends boolean | undefined = false> = Omit<
  // `boolean`, not `Multiple`: naming `Multiple` inside `Omit` stops TypeScript
  // inferring the callback parameters at call sites.
  ComboboxRootProps<Value, boolean>,
  "items" | "filter" | "multiple" | "value" | "defaultValue" | "onValueChange"
> &
  LegacyNames<Value> & {
    /** Raw values, as Base UI took them. A list function child renders each. */
    items?: readonly Value[];
    /** `null` is Base UI's "keep every item"; UI SDK spells it `false`. */
    filter?: ComboboxRootProps<Value, boolean>["filter"] | null;
    multiple?: Multiple;
    value?: Selection<Value, Multiple>;
    defaultValue?: Selection<Value, Multiple>;
    onValueChange?: (
      value: Selection<Value, Multiple>,
      details: ChangeDetails<ComboboxValueChangeReason>,
    ) => void;
  };

/**
 * The raw `items`, for a list function child. They are not handed to UI SDK:
 * with `items` data, UI SDK takes each item's `disabled` from the data, not from
 * the rendered item, so a disabled item could still be picked. Rendered items
 * still filter, by their label.
 */
const ItemsContext = React.createContext<readonly unknown[] | undefined>(
  undefined,
);

// The wrapper's own props already type the call site; UI SDK's root is generic
// over a union that cannot be re-inferred from the mapped props.
const LooseRoot = ComboboxRoot as unknown as React.ComponentType<
  Record<string, unknown>
>;

function Combobox<
  Value = string,
  Multiple extends boolean | undefined = false,
>({
  items,
  filter,
  itemToStringLabel,
  itemToStringValue,
  onInputValueChange,
  inputValue,
  defaultInputValue,
  ...props
}: ComboboxProps<Value, Multiple>) {
  const mapped = {
    ...props,
    ...(filter === undefined ? null : { filter: filter ?? false }),
    ...(itemToStringLabel ? { itemToLabel: itemToStringLabel } : null),
    ...(itemToStringValue ? { itemToValue: itemToStringValue } : null),
    ...(onInputValueChange ? { onQueryChange: onInputValueChange } : null),
    ...(inputValue === undefined ? null : { query: inputValue }),
    ...(defaultInputValue === undefined
      ? null
      : { defaultQuery: defaultInputValue }),
  };

  return (
    <ItemsContext.Provider value={items}>
      <LooseRoot {...mapped} />
    </ItemsContext.Provider>
  );
}

function ComboboxChipsInput({
  className,
  size,
  ...props
}: Omit<React.ComponentProps<typeof ComboboxInputPrimitive>, "size"> & {
  size?: "sm" | "default" | "lg" | number;
  ref?: React.Ref<HTMLInputElement>;
}) {
  const sizeValue = (size ?? "default") as "sm" | "default" | "lg" | number;

  return (
    <ComboboxInputPrimitive
      className={cn(
        "min-w-12 flex-1 text-base outline-none sm:text-sm [[data-slot=combobox-chip]+&]:ps-0.5",
        sizeValue === "sm" ? "ps-1.5" : "ps-2",
        className,
      )}
      data-size={typeof sizeValue === "string" ? sizeValue : undefined}
      data-slot="combobox-chips-input"
      size={typeof sizeValue === "number" ? sizeValue : undefined}
      {...props}
    />
  );
}

function ComboboxInput({
  className,
  showTrigger = true,
  showClear = false,
  startAddon,
  size,
  ...props
}: Omit<React.ComponentProps<typeof ComboboxInputPrimitive>, "size"> & {
  showTrigger?: boolean;
  showClear?: boolean;
  startAddon?: React.ReactNode;
  size?: "sm" | "default" | "lg" | number;
  ref?: React.Ref<HTMLInputElement>;
}) {
  const sizeValue = (size ?? "default") as "sm" | "default" | "lg" | number;

  return (
    <div className="relative not-has-[>*.w-full]:w-fit w-full text-foreground has-disabled:opacity-64">
      {startAddon && (
        <div
          aria-hidden="true"
          className="[&_svg]:-mx-0.5 pointer-events-none absolute inset-y-0 start-px z-10 flex items-center ps-[calc(--spacing(3)-1px)] opacity-80 has-[+[data-size=sm]]:ps-[calc(--spacing(2.5)-1px)] [&_svg:not([class*='size-'])]:size-4.5 sm:[&_svg:not([class*='size-'])]:size-4"
          data-slot="combobox-start-addon"
        >
          {startAddon}
        </div>
      )}
      <ComboboxInputPrimitive
        className={cn(
          startAddon &&
            "data-[size=sm]:*:data-[slot=combobox-input]:ps-[calc(--spacing(7.5)-1px)] *:data-[slot=combobox-input]:ps-[calc(--spacing(8.5)-1px)] sm:data-[size=sm]:*:data-[slot=combobox-input]:ps-[calc(--spacing(7)-1px)] sm:*:data-[slot=combobox-input]:ps-[calc(--spacing(8)-1px)]",
          sizeValue === "sm"
            ? "has-[+[data-slot=combobox-trigger],+[data-slot=combobox-clear]]:*:data-[slot=combobox-input]:pe-6.5"
            : "has-[+[data-slot=combobox-trigger],+[data-slot=combobox-clear]]:*:data-[slot=combobox-input]:pe-7",
          className,
        )}
        data-slot="combobox-input"
        render={
          <Input
            className="has-disabled:opacity-100"
            nativeInput
            size={sizeValue}
          />
        }
        {...props}
      />
      {showTrigger && (
        <ComboboxTrigger
          className={cn(
            "-translate-y-1/2 absolute top-1/2 inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md border border-transparent opacity-80 outline-none transition-opacity pointer-coarse:after:absolute pointer-coarse:after:min-h-11 pointer-coarse:after:min-w-11 hover:opacity-100 has-[+[data-slot=combobox-clear]]:hidden sm:size-7 [&_svg:not([class*='size-'])]:size-4.5 sm:[&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
            sizeValue === "sm" ? "end-0" : "end-0.5",
          )}
        >
          <span data-slot="combobox-icon">
            <ChevronsUpDownIcon />
          </span>
        </ComboboxTrigger>
      )}
      {showClear && (
        <ComboboxClear
          aria-label={i18n.t("common:actions.remove")}
          className={cn(
            "-translate-y-1/2 absolute top-1/2 inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-md border border-transparent opacity-80 outline-none transition-opacity pointer-coarse:after:absolute pointer-coarse:after:min-h-11 pointer-coarse:after:min-w-11 hover:opacity-100 has-[+[data-slot=combobox-clear]]:hidden sm:size-7 [&_svg:not([class*='size-'])]:size-4.5 sm:[&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
            sizeValue === "sm" ? "end-0" : "end-0.5",
          )}
        >
          <XIcon />
        </ComboboxClear>
      )}
    </div>
  );
}

function ComboboxTrigger({
  className,
  children,
  ...props
}: React.ComponentProps<typeof ComboboxTriggerPrimitive>) {
  return (
    <ComboboxTriggerPrimitive
      className={className}
      data-slot="combobox-trigger"
      {...props}
    >
      {children}
    </ComboboxTriggerPrimitive>
  );
}

function ComboboxPopup({
  className,
  children,
  side = "bottom",
  sideOffset = 4,
  align = "start",
  containEvents = true,
  ...props
}: React.ComponentProps<typeof ComboboxContentPrimitive> & {
  /** Contain pointer and command events in the content. Keys always pass. */
  containEvents?: boolean;
}) {
  return (
    <ComboboxContentPrimitive
      {...containPopupEvents(
        {
          align,
          className: cn(
            POPUP_RESET,
            "relative flex max-h-[min(var(--available-height),23rem)] min-w-(--anchor-width) max-w-(--available-width) origin-(--transform-origin) select-none flex-col rounded-lg border bg-popover not-dark:bg-clip-padding shadow-lg/5 transition-[scale,opacity] before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-lg)-1px)] before:shadow-[0_1px_--theme(--color-black/4%)] dark:before:shadow-[0_-1px_--theme(--color-white/6%)]",
            className,
          ),
          side,
          sideOffset,
          children,
          ...props,
        },
        containEvents,
      )}
    />
  );
}

function ComboboxItem<Value = string>({
  className,
  children,
  ...props
}: Omit<
  React.ComponentProps<typeof ComboboxItemPrimitive>,
  "children" | "value"
> & { children?: React.ReactNode; value: Value }) {
  return (
    <ComboboxItemPrimitive
      className={cn(
        "grid min-h-8 in-data-[side=none]:min-w-[calc(var(--anchor-width)+1.25rem)] cursor-default grid-cols-[1rem_1fr] items-center gap-2 rounded-sm py-1 ps-2 pe-4 text-base outline-none data-disabled:pointer-events-none data-highlighted:bg-accent data-highlighted:text-accent-foreground data-disabled:opacity-64 sm:min-h-7 sm:text-sm [&_svg:not([class*='size-'])]:size-4.5 sm:[&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
        className,
      )}
      data-slot="combobox-item"
      {...props}
    >
      <ComboboxItemIndicatorPrimitive className="col-start-1">
        <svg
          aria-hidden="true"
          fill="none"
          height="24"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          viewBox="0 0 24 24"
          width="24"
          xmlns="http://www.w3.org/1500/svg"
        >
          <path d="M5.252 12.7 10.2 18.63 18.748 5.37" />
        </svg>
      </ComboboxItemIndicatorPrimitive>
      <div className="col-start-2">{children}</div>
    </ComboboxItemPrimitive>
  );
}

function ComboboxSeparator({
  className,
  ...props
}: React.ComponentProps<typeof ComboboxSeparatorPrimitive>) {
  return (
    <ComboboxSeparatorPrimitive
      className={cn("mx-2 my-1 h-px bg-border last:hidden", className)}
      {...props}
    />
  );
}

function ComboboxGroup({
  className,
  ...props
}: React.ComponentProps<typeof ComboboxGroupPrimitive>) {
  return (
    <ComboboxGroupPrimitive
      className={cn("[[role=group]+&]:mt-1.5", className)}
      {...props}
    />
  );
}

function ComboboxGroupLabel({
  className,
  ...props
}: React.ComponentProps<typeof ComboboxGroupLabelPrimitive>) {
  return (
    <ComboboxGroupLabelPrimitive
      className={cn(
        "px-2 py-1.5 font-medium text-muted-foreground text-xs",
        className,
      )}
      {...props}
    />
  );
}

function ComboboxEmpty({
  className,
  ...props
}: React.ComponentProps<typeof ComboboxEmptyPrimitive>) {
  return (
    <ComboboxEmptyPrimitive
      className={cn(
        "not-empty:p-2 text-center text-base text-muted-foreground sm:text-sm",
        className,
      )}
      {...props}
    />
  );
}

/**
 * Base UI took `(selectedValue) => node`. UI SDK hands a state object, so a
 * function child gets `state.value` here.
 */
function ComboboxValue({
  children,
  ...props
}: Omit<React.ComponentProps<typeof ComboboxValuePrimitive>, "children"> & {
  children?: React.ReactNode | ((selectedValue: any) => React.ReactNode);
}) {
  return (
    <ComboboxValuePrimitive {...props}>
      {typeof children === "function"
        ? (state) => children(state.value)
        : children}
    </ComboboxValuePrimitive>
  );
}

/** Base UI took `(item, index) => node` for each raw item in `items`. */
function ComboboxList({
  className,
  children,
  ...props
}: Omit<React.ComponentProps<typeof ComboboxListPrimitive>, "children"> & {
  children?: React.ReactNode | ((item: any, index: number) => React.ReactNode);
}) {
  const items = React.useContext(ItemsContext);
  return (
    <ScrollArea scrollbarGutter scrollFade>
      <ComboboxListPrimitive
        className={cn(
          "not-empty:scroll-py-1 not-empty:px-1 not-empty:py-1 in-data-overflow-y:pe-3",
          className,
        )}
        {...props}
      >
        {typeof children === "function"
          ? items?.map((item, index) => children(item, index))
          : children}
      </ComboboxListPrimitive>
    </ScrollArea>
  );
}

function ComboboxClear({
  className,
  ...props
}: React.ComponentProps<typeof ComboboxClearPrimitive>) {
  return <ComboboxClearPrimitive className={className} {...props} />;
}

function ComboboxStatus({
  className,
  ...props
}: React.ComponentProps<typeof ComboboxStatusPrimitive>) {
  return (
    <ComboboxStatusPrimitive
      className={cn(
        "px-3 py-2 font-medium text-muted-foreground text-xs empty:m-0 empty:p-0",
        className,
      )}
      {...props}
    />
  );
}

function ComboboxChips({
  className,
  children,
  startAddon,
  ...props
}: Omit<React.ComponentProps<typeof ComboboxChipsPrimitive>, "children"> & {
  children?: React.ReactNode;
  startAddon?: React.ReactNode;
}) {
  return (
    <ComboboxChipsPrimitive
      className={cn(
        "relative inline-flex min-h-9 w-full flex-wrap gap-1 rounded-lg border border-input bg-background not-dark:bg-clip-padding p-[calc(--spacing(1)-1px)] text-base shadow-xs/5 outline-none ring-ring/24 transition-shadow *:min-h-7 before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-lg)-1px)] not-has-disabled:not-focus-within:not-aria-invalid:before:shadow-[0_1px_--theme(--color-black/4%)] focus-within:border-ring focus-within:ring-[3px] has-disabled:pointer-events-none has-data-[size=lg]:min-h-10 has-data-[size=sm]:min-h-8 has-aria-invalid:border-destructive/36 has-autofill:bg-foreground/4 has-disabled:opacity-64 has-[:disabled,:focus-within,[aria-invalid]]:shadow-none focus-within:has-aria-invalid:border-destructive/64 focus-within:has-aria-invalid:ring-destructive/16 has-data-[size=lg]:*:min-h-8 has-data-[size=sm]:*:min-h-6 sm:min-h-8 sm:text-sm sm:has-data-[size=lg]:min-h-9 sm:has-data-[size=sm]:min-h-7 sm:*:min-h-6 sm:has-data-[size=lg]:*:min-h-7 sm:has-data-[size=sm]:*:min-h-5 dark:not-has-disabled:bg-input/32 dark:has-autofill:bg-foreground/8 dark:has-aria-invalid:ring-destructive/24 dark:not-has-disabled:not-focus-within:not-aria-invalid:before:shadow-[0_-1px_--theme(--color-white/6%)]",
        className,
      )}
      {...props}
    >
      {startAddon && (
        <div
          aria-hidden="true"
          className="[&_svg]:-ms-0.5 [&_svg]:-me-1.5 flex shrink-0 items-center ps-2 opacity-80 has-[~[data-size=sm]]:has-[+[data-slot=combobox-chip]]:pe-1.5 has-[~[data-size=sm]]:ps-1.5 has-[+[data-slot=combobox-chip]]:pe-2 [&_svg:not([class*='size-'])]:size-4.5 sm:[&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none"
          data-slot="combobox-start-addon"
        >
          {startAddon}
        </div>
      )}
      {children}
    </ComboboxChipsPrimitive>
  );
}

function ComboboxChip<Value = string>({
  children,
  ...props
}: Omit<
  React.ComponentProps<typeof ComboboxChipPrimitive<Value>>,
  "children"
> & { children?: React.ReactNode }) {
  return (
    <ComboboxChipPrimitive
      className="flex items-center rounded-[calc(var(--radius-md)-1px)] bg-accent ps-2 font-medium text-accent-foreground text-sm outline-none sm:text-xs/(--text-xs--line-height) [&_svg:not([class*='size-'])]:size-4 sm:[&_svg:not([class*='size-'])]:size-3.5"
      {...props}
    >
      {children}
      <ComboboxChipRemove />
    </ComboboxChipPrimitive>
  );
}

function ComboboxChipRemove(
  props: React.ComponentProps<typeof ComboboxChipRemovePrimitive>,
) {
  return (
    <ComboboxChipRemovePrimitive
      aria-label={i18n.t("common:actions.remove")}
      className="h-full shrink-0 cursor-pointer px-1.5 opacity-80 hover:opacity-100 [&_svg:not([class*='size-'])]:size-4 sm:[&_svg:not([class*='size-'])]:size-3.5"
      {...props}
    >
      <XIcon />
    </ComboboxChipRemovePrimitive>
  );
}

export {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxClear,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxGroupLabel,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxPopup,
  ComboboxSeparator,
  ComboboxStatus,
  ComboboxTrigger,
  ComboboxValue,
};
