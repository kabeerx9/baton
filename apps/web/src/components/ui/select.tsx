"use client";

import {
  Select as SelectPrimitive,
  SelectContent as SelectContentPrimitive,
  SelectGroup as SelectGroupPrimitive,
  SelectGroupLabel as SelectGroupLabelPrimitive,
  SelectItem as SelectItemPrimitive,
  SelectItemIndicator,
  SelectList,
  SelectSeparator as SelectSeparatorPrimitive,
  SelectTrigger as SelectTriggerPrimitive,
  SelectValue as SelectValuePrimitive,
  type ListData,
  type SelectProps as SelectPrimitiveProps,
} from "@ui-sdk/react/select";
import {
  mergeProps,
  renderElement,
  type PartProps,
} from "@ui-sdk/react/primitive";
import { cva, type VariantProps } from "class-variance-authority";
import { ChevronsUpDownIcon } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/cn";
import { containPopupEvents } from "./popup-containment";
import { POPUP_RESET } from "./popup-reset";

/** What Base UI took as `items`: a value-to-label record. UI SDK takes a list. */
type ItemsRecord = Record<string, string>;

function toListData<T>(
  items: ListData<T> | ItemsRecord | undefined,
): ListData<T> | undefined {
  if (items === undefined || Array.isArray(items)) {
    return items as ListData<T> | undefined;
  }
  return Object.entries(items).map(([value, label]) => ({
    label,
    value,
  })) as ListData<T>;
}

// The root props are a union (single, multiple, either), so Omit must
// distribute or `onValueChange` loses its contextual type.
type DistributiveOmit<U, K extends PropertyKey> = U extends unknown
  ? Omit<U, K>
  : never;

type SelectRootProps<
  T,
  Multiple extends boolean | undefined,
> = DistributiveOmit<
  SelectPrimitiveProps<T, Multiple>,
  "items" | "itemToLabel" | "itemToValue"
> & {
  // Not an inference site: `value` and the callbacks decide T.
  items?: NoInfer<ListData<T>> | ItemsRecord;
  /** Base UI name for `itemToLabel`. */
  itemToStringLabel?: SelectPrimitiveProps<T, Multiple>["itemToLabel"];
  /** Base UI name for `itemToValue`. */
  itemToStringValue?: SelectPrimitiveProps<T, Multiple>["itemToValue"];
};

function Select<T = string, Multiple extends boolean | undefined = false>({
  items,
  itemToStringLabel,
  itemToStringValue,
  modal = true,
  ...props
}: SelectRootProps<T, Multiple>) {
  return (
    <SelectPrimitive<T, Multiple>
      items={toListData<T>(items)}
      itemToLabel={itemToStringLabel}
      itemToValue={itemToStringValue}
      // Base UI's Select was modal by default (page scroll locked, the rest of
      // the page inert); UI SDK defaults to "pointer".
      modal={modal}
      {...(props as SelectPrimitiveProps<T, Multiple>)}
    />
  );
}

const selectTriggerVariants = cva(
  "relative inline-flex min-h-9 w-full min-w-36 cursor-pointer select-none items-center justify-between gap-2 rounded-lg border border-input bg-background not-dark:bg-clip-padding px-[calc(--spacing(3)-1px)] text-left text-base text-foreground shadow-xs/5 outline-none ring-ring/24 transition-shadow before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-lg)-1px)] not-data-disabled:not-focus-visible:not-aria-invalid:not-data-pressed:before:shadow-[0_1px_--theme(--color-black/4%)] pointer-coarse:after:absolute pointer-coarse:after:size-full pointer-coarse:after:min-h-11 focus-visible:border-ring focus-visible:ring-[3px] aria-invalid:border-destructive/36 focus-visible:aria-invalid:border-destructive/64 focus-visible:aria-invalid:ring-destructive/16 data-disabled:pointer-events-none data-disabled:opacity-64 sm:min-h-8 sm:text-sm dark:bg-input/32 dark:aria-invalid:ring-destructive/24 dark:not-data-disabled:not-focus-visible:not-aria-invalid:not-data-pressed:before:shadow-[0_-1px_--theme(--color-white/6%)] [&_svg:not([class*='opacity-'])]:opacity-80 [&_svg:not([class*='size-'])]:size-4.5 sm:[&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0 [[data-disabled],:focus-visible,[aria-invalid],[data-pressed]]:shadow-none",
  {
    defaultVariants: {
      size: "default",
    },
    variants: {
      size: {
        default: "",
        lg: "min-h-10 sm:min-h-9",
        sm: "min-h-8 gap-1.5 px-[calc(--spacing(2.5)-1px)] sm:min-h-7",
      },
    },
  },
);

const selectTriggerIconClassName = "-me-1 size-4.5 opacity-80 sm:size-4";

interface SelectButtonProps extends Omit<
  PartProps<"button">,
  "className" | "children"
> {
  className?: string;
  children?: React.ReactNode;
  size?: VariantProps<typeof selectTriggerVariants>["size"];
}

function SelectButton({
  className,
  size,
  render,
  children,
  ...props
}: SelectButtonProps) {
  const typeValue: React.ButtonHTMLAttributes<HTMLButtonElement>["type"] =
    render ? undefined : "button";

  const defaultProps = {
    children: (
      <>
        <span className="flex-1 truncate in-data-placeholder:text-muted-foreground/72">
          {children}
        </span>
        <ChevronsUpDownIcon className={selectTriggerIconClassName} />
      </>
    ),
    className: cn(selectTriggerVariants({ size }), "min-w-none", className),
    "data-slot": "select-button",
    type: typeValue,
  };

  return renderElement("button", mergeProps(defaultProps, props), render);
}

type SelectTriggerProps = Omit<
  React.ComponentProps<typeof SelectTriggerPrimitive>,
  "className" | "children"
> &
  VariantProps<typeof selectTriggerVariants> & {
    className?: string;
    children?: React.ReactNode;
  };

function SelectTrigger({
  className,
  size = "default",
  children,
  ...props
}: SelectTriggerProps) {
  return (
    <SelectTriggerPrimitive
      className={cn(selectTriggerVariants({ size }), className)}
      {...props}
    >
      {children}
      <ChevronsUpDownIcon className={selectTriggerIconClassName} />
    </SelectTriggerPrimitive>
  );
}

type SelectValueProps = Omit<
  React.ComponentProps<typeof SelectValuePrimitive>,
  "className" | "children"
> & {
  className?: string;
  /** A node, or, as in Base UI, a function of the selected value. */
  children?: React.ReactNode | ((value: unknown) => React.ReactNode);
};

function SelectValue({ className, children, ...props }: SelectValueProps) {
  return (
    <SelectValuePrimitive
      className={cn(
        "flex-1 truncate data-placeholder:text-muted-foreground",
        className,
      )}
      {...props}
    >
      {typeof children === "function"
        ? (state: { value: unknown }) => children(state.value)
        : children}
    </SelectValuePrimitive>
  );
}

type SelectContentProps = Omit<
  React.ComponentProps<typeof SelectContentPrimitive>,
  "className" | "side"
> & {
  /** `inline-start` and `inline-end` are Base UI's names for `start` and `end`. */
  side?:
    | React.ComponentProps<typeof SelectContentPrimitive>["side"]
    | "inline-start"
    | "inline-end";
  className?: string;
  /** Contain pointer and command events in the content. Keys always pass. */
  containEvents?: boolean;
};

function SelectContent({
  className,
  children,
  side = "bottom",
  sideOffset = 4,
  align = "start",
  alignOffset = 0,
  alignItemWithTrigger = true,
  containEvents = true,
  ...props
}: SelectContentProps) {
  return (
    <SelectContentPrimitive
      {...containPopupEvents(
        {
          align,
          alignItemWithTrigger,
          alignOffset,
          className: cn(
            POPUP_RESET,
            // --available-height is not inherited: copy it for the list.
            "z-50 select-none overflow-visible border-0 bg-transparent p-0 origin-(--transform-origin) [--list-height:var(--available-height)] transition-[scale,opacity,translate] duration-150 ease-out data-starting-style:scale-98 data-starting-style:opacity-0 data-ending-style:scale-98 data-ending-style:opacity-0 data-[side=top]:data-starting-style:translate-y-1 data-[side=bottom]:data-starting-style:-translate-y-1 data-[side=left]:data-starting-style:translate-x-1 data-[side=right]:data-starting-style:-translate-x-1",
          ),
          side:
            side === "inline-start"
              ? "start"
              : side === "inline-end"
                ? "end"
                : side,
          sideOffset,
          ...props,
        },
        containEvents,
      )}
    >
      <div className="relative h-full min-w-(--anchor-width) rounded-lg border bg-popover not-dark:bg-clip-padding shadow-lg/5 before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-lg)-1px)] before:shadow-[0_1px_--theme(--color-black/4%)] dark:before:shadow-[0_-1px_--theme(--color-white/6%)]">
        <SelectList
          className={cn(
            "overflow-y-auto p-1",
            // Aligned, the popup moves with its height, and --available-height
            // moves with the popup: sizing by it flips between two layouts.
            alignItemWithTrigger
              ? "max-h-[min(24rem,calc(100dvh-2rem))]"
              : "max-h-(--list-height)",
            className,
          )}
        >
          {children}
        </SelectList>
      </div>
    </SelectContentPrimitive>
  );
}

type SelectItemProps<T> = Omit<
  React.ComponentProps<typeof SelectItemPrimitive<T>>,
  "className" | "children"
> & { className?: string; children?: React.ReactNode };

function SelectItem<T = string>({
  className,
  children,
  ...props
}: SelectItemProps<T>) {
  return (
    <SelectItemPrimitive<T>
      className={cn(
        "grid min-h-8 cursor-default grid-cols-[1rem_1fr] items-center gap-2 rounded-sm py-1 ps-2 pe-4 text-base outline-none data-disabled:pointer-events-none data-highlighted:bg-accent data-highlighted:text-accent-foreground data-disabled:opacity-64 sm:min-h-7 sm:text-sm [&_svg:not([class*='size-'])]:size-4.5 sm:[&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
        className,
      )}
      {...(props as React.ComponentProps<typeof SelectItemPrimitive<T>>)}
    >
      <SelectItemIndicator className="col-start-1">
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
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M5.252 12.7 10.2 18.63 18.748 5.37" />
        </svg>
      </SelectItemIndicator>
      <span className="col-start-2 min-w-0">{children}</span>
    </SelectItemPrimitive>
  );
}

type SelectSeparatorProps = Omit<
  React.ComponentProps<typeof SelectSeparatorPrimitive>,
  "className"
> & { className?: string };

function SelectSeparator({ className, ...props }: SelectSeparatorProps) {
  return (
    <SelectSeparatorPrimitive
      className={cn("mx-2 my-1 h-px bg-border", className)}
      {...props}
    />
  );
}

function SelectGroup(props: React.ComponentProps<typeof SelectGroupPrimitive>) {
  return <SelectGroupPrimitive {...props} />;
}

type SelectGroupLabelProps = Omit<
  React.ComponentProps<typeof SelectGroupLabelPrimitive>,
  "className"
> & { className?: string };

function SelectGroupLabel({ className, ...props }: SelectGroupLabelProps) {
  return (
    <SelectGroupLabelPrimitive
      className={cn(
        "px-2 py-1.5 font-medium text-muted-foreground text-xs",
        className,
      )}
      {...props}
    />
  );
}

export {
  Select,
  SelectButton,
  SelectGroup,
  SelectGroupLabel,
  SelectItem,
  SelectContent as SelectPopup,
  SelectContent,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
};
