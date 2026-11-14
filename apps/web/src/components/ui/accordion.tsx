"use client";

import {
  Accordion as AccordionRoot,
  AccordionHeader,
  AccordionItem as AccordionItemPart,
  AccordionPanel as AccordionPanelPart,
  AccordionTrigger as AccordionTriggerPart,
} from "@ui-sdk/react/accordion";
import { ChevronDownIcon } from "lucide-react";
import type * as React from "react";
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

function Accordion(props: AccordionProps) {
  return <AccordionRoot {...props} />;
}

function AccordionItem({ className, ...props }: AccordionItemProps) {
  return (
    <AccordionItemPart
      className={cn("border-b last:border-b-0", className)}
      {...props}
    />
  );
}

function AccordionTrigger({
  className,
  children,
  ...props
}: AccordionTriggerProps) {
  return (
    <AccordionHeader className="flex">
      <AccordionTriggerPart
        className={cn(
          "flex flex-1 cursor-pointer items-start justify-between gap-4 rounded-md py-4 text-left font-medium text-sm outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring aria-disabled:pointer-events-none aria-disabled:opacity-64 data-open:*:data-[slot=accordion-indicator]:rotate-180",
          className,
        )}
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

export {
  Accordion,
  AccordionItem,
  AccordionPanel,
  AccordionPanel as AccordionContent,
  AccordionTrigger,
};
