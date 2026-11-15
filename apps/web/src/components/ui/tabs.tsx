"use client";

import {
  Tabs as TabsRoot,
  TabsIndicator as TabsIndicatorPart,
  TabsList as TabsListPart,
  TabsPanel as TabsPanelPart,
  TabsTab as TabsTabPart,
} from "@ui-sdk/react/tabs";
import * as React from "react";
import { cn } from "@/lib/cn";

type TabsProps = Omit<React.ComponentProps<typeof TabsRoot>, "className"> & {
  className?: string;
};

function Tabs({ className, ...props }: TabsProps) {
  return (
    <TabsRoot
      data-slot="tabs"
      className={cn("flex flex-col gap-3", className)}
      {...props}
    />
  );
}

type TabsListProps = Omit<
  React.ComponentProps<typeof TabsListPart>,
  "className" | "children"
> & {
  className?: string;
  children?: React.ReactNode;
};

// The list carries one sliding indicator that follows the selected tab. It
// moves with `transform`-class cost only on width/left, and stays still on the
// first placement (data-activation-direction="none") and for reduced motion.
function TabsList({ className, children, ...props }: TabsListProps) {
  return (
    <TabsListPart
      data-slot="tabs-list"
      className={cn(
        "relative inline-flex w-fit items-center gap-1 rounded-lg bg-muted p-1 text-muted-foreground",
        className,
      )}
      {...props}
    >
      {children}
      <TabsIndicatorPart
        data-slot="tabs-indicator"
        className="pointer-events-none absolute top-(--active-tab-top) left-(--active-tab-left) h-(--active-tab-height) w-(--active-tab-width) rounded-md bg-background shadow-sm/5 ring-1 ring-border/60 transition-[left,width] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] data-[activation-direction=none]:transition-none motion-reduce:transition-none"
      />
    </TabsListPart>
  );
}

type TabsTabProps = Omit<
  React.ComponentProps<typeof TabsTabPart>,
  "className"
> & {
  className?: string;
};

function TabsTab({ className, ...props }: TabsTabProps) {
  return (
    <TabsTabPart
      data-slot="tabs-tab"
      className={cn(
        "relative z-10 inline-flex h-7 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 font-medium text-sm outline-none transition-colors duration-150 ease-out hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring data-selected:text-foreground aria-disabled:pointer-events-none aria-disabled:opacity-64 [&_svg]:size-4",
        className,
      )}
      {...props}
    />
  );
}

type TabsPanelProps = Omit<
  React.ComponentProps<typeof TabsPanelPart>,
  "className"
> & {
  className?: string;
};

function TabsPanel({ className, ...props }: TabsPanelProps) {
  return (
    <TabsPanelPart
      data-slot="tabs-panel"
      className={cn(
        "outline-none focus-visible:ring-[3px] focus-visible:ring-ring rounded-lg",
        className,
      )}
      {...props}
    />
  );
}

export { Tabs, TabsList, TabsPanel, TabsTab };
