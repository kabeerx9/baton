"use client";

import {
  Accordion as AccordionRoot,
  AccordionHeader,
  AccordionItem as AccordionItemPart,
  AccordionPanel as AccordionPanelPart,
  AccordionTrigger as AccordionTriggerPart,
} from "@ui-sdk/react/accordion";
import { ChevronDownIcon } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/cn";

type AccordionProps = React.ComponentProps<typeof AccordionRoot>;

type AccordionItemProps = Omit<
  React.ComponentProps<typeof AccordionItemPart>,
  "className"
> & { className?: string };

type AccordionTriggerProps = Omit<
  React.ComponentProps<typeof AccordionTriggerPart>,
  "className" | "children"
> & {
  className?: string;
  children?: React.ReactNode;
};

type AccordionPanelProps = Omit<
  React.ComponentProps<typeof AccordionPanelPart>,
  "className" | "children"
> & {
  className?: string;
  children?: React.ReactNode;
};

// UI SDK marks a disabled trigger with aria-disabled and keeps it focusable.
// Base UI rendered a native disabled button for a disabled accordion or item,
// so carry both levels of disabled state down to the trigger.
const RootDisabledContext = React.createContext(false);
const ItemDisabledContext = React.createContext(false);

function Accordion({ disabled, ...props }: AccordionProps) {
  return (
    <RootDisabledContext.Provider value={Boolean(disabled)}>
      <AccordionRoot disabled={disabled} {...props} />
    </RootDisabledContext.Provider>
  );
}

function AccordionItem({ className, disabled, ...props }: AccordionItemProps) {
  const rootDisabled = React.useContext(RootDisabledContext);

  return (
    <ItemDisabledContext.Provider value={Boolean(disabled || rootDisabled)}>
      <AccordionItemPart
        className={cn("border-b last:border-b-0", className)}
        disabled={disabled}
        {...props}
      />
    </ItemDisabledContext.Provider>
  );
}

function AccordionTrigger({
  className,
  children,
  disabled,
  render,
  ...props
}: AccordionTriggerProps) {
  const itemDisabled = React.useContext(ItemDisabledContext);
  const isDisabled = Boolean(disabled || itemDisabled);
  const callerButton =
    React.isValidElement<{ disabled?: boolean }>(render) &&
    render.type === "button"
      ? render
      : undefined;
  // The trigger consumes `disabled`, so it never reaches the element. Base UI
  // rendered a native disabled button for a disabled accordion or item, even
  // when the caller supplied that button, so render the button ourselves and
  // let the native attribute through. A non-button custom element keeps Base
  // UI's aria-disabled-only behavior.
  const triggerRender =
    isDisabled && (callerButton || render === undefined)
      ? React.cloneElement(callerButton ?? <button />, { disabled: true })
      : render;

  return (
    <AccordionHeader className="flex">
      <AccordionTriggerPart
        className={cn(
          "flex flex-1 cursor-pointer items-start justify-between gap-4 rounded-md py-4 text-left font-medium text-sm outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring aria-disabled:pointer-events-none aria-disabled:opacity-64 data-open:*:data-[slot=accordion-indicator]:rotate-180",
          className,
        )}
        disabled={disabled}
        render={triggerRender}
        {...props}
      >
        {children}
        <ChevronDownIcon
          className="pointer-events-none size-4 shrink-0 translate-y-0.5 opacity-80 transition-transform duration-200 ease-in-out"
          data-slot="accordion-indicator"
        />
      </AccordionTriggerPart>
    </AccordionHeader>
  );
}

function AccordionPanel({
  className,
  children,
  ...props
}: AccordionPanelProps) {
  return (
    <AccordionPanelPart
      className="h-(--accordion-panel-height) overflow-hidden text-muted-foreground text-sm transition-[height] duration-200 ease-in-out data-ending-style:h-0 data-starting-style:h-0"
      {...props}
    >
      <div className={cn("pt-0 pb-4", className)}>{children}</div>
    </AccordionPanelPart>
  );
}

export { Accordion, AccordionItem, AccordionPanel, AccordionTrigger };
