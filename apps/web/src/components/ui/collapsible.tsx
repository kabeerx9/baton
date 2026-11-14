"use client";

import {
  Collapsible as CollapsibleRoot,
  CollapsiblePanel as CollapsiblePanelPart,
  CollapsibleTrigger as CollapsibleTriggerPart,
} from "@ui-sdk/react/collapsible";
import * as React from "react";
import { cn } from "@/lib/cn";

type CollapsibleProps = React.ComponentProps<typeof CollapsibleRoot>;

type CollapsibleTriggerProps = Omit<
  React.ComponentProps<typeof CollapsibleTriggerPart>,
  "className" | "children"
> & {
  asChild?: boolean;
  className?: string;
  children?: React.ReactNode;
};

type CollapsiblePanelProps = Omit<
  React.ComponentProps<typeof CollapsiblePanelPart>,
  "className"
> & { className?: string };

function Collapsible(props: CollapsibleProps) {
  return <CollapsibleRoot {...props} />;
}

function CollapsibleTrigger({
  asChild = false,
  className,
  children,
  render,
  ...props
}: CollapsibleTriggerProps) {
  const resolvedRender =
    asChild && React.isValidElement<Record<string, unknown>>(children)
      ? children
      : render;

  return (
    <CollapsibleTriggerPart
      className={cn("cursor-pointer", className)}
      render={resolvedRender}
      {...props}
    >
      {asChild ? undefined : children}
    </CollapsibleTriggerPart>
  );
}

function CollapsiblePanel({ className, ...props }: CollapsiblePanelProps) {
  return (
    <CollapsiblePanelPart
      className={cn(
        "h-(--collapsible-panel-height) overflow-hidden transition-[height] duration-200 ease-in-out data-ending-style:h-0 data-starting-style:h-0",
        className,
      )}
      {...props}
    />
  );
}

export {
  Collapsible,
  CollapsiblePanel,
  CollapsiblePanel as CollapsibleContent,
  CollapsibleTrigger,
};
