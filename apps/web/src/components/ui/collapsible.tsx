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

// UI SDK marks a disabled trigger with aria-disabled and keeps it focusable.
// Base UI rendered a native disabled button, so carry the root's disabled state
// down to the trigger and let it set the attribute itself.
const DisabledContext = React.createContext(false);

function Collapsible({ disabled, ...props }: CollapsibleProps) {
  return (
    <DisabledContext.Provider value={Boolean(disabled)}>
      <CollapsibleRoot disabled={disabled} {...props} />
    </DisabledContext.Provider>
  );
}

function CollapsibleTrigger({
  asChild = false,
  className,
  children,
  render,
  disabled,
  ...props
}: CollapsibleTriggerProps) {
  const rootDisabled = React.useContext(DisabledContext);
  const resolvedRender =
    asChild && React.isValidElement<Record<string, unknown>>(children)
      ? children
      : render;

  return (
    <CollapsibleTriggerPart
      className={cn("cursor-pointer", className)}
      // The part's own button forwards unknown props, so this becomes the
      // native disabled attribute. A caller-supplied element keeps Base UI's
      // nativeButton={false} behavior and only carries aria-disabled.
      disabled={
        resolvedRender
          ? disabled
          : Boolean(disabled || rootDisabled) || undefined
      }
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
