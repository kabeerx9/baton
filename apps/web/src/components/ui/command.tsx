"use client";

import { Dialog as CommandDialogPrimitive } from "@base-ui/react/dialog";
import {
  Command as CommandRoot,
  CommandEmpty as CommandEmptyPrimitive,
  CommandGroup as CommandGroupPrimitive,
  CommandGroupLabel as CommandGroupLabelPrimitive,
  CommandInput as CommandInputPrimitive,
  CommandItem as CommandItemPrimitive,
  CommandItemText as CommandItemTextPrimitive,
  CommandList as CommandListPrimitive,
  CommandSeparator as CommandSeparatorPrimitive,
  CommandStatus as CommandStatusPrimitive,
  type SearchFilter,
} from "@ui-sdk/react/command";
import { SearchIcon } from "lucide-react";
import type * as React from "react";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/cn";

// The unstyled parts, for a feature that lays out its own list (the option
// menu). Features import this from here, never from the library.
const CommandPrimitive = {
  Root: CommandRoot,
  Input: CommandInputPrimitive,
  List: CommandListPrimitive,
  Item: CommandItemPrimitive,
  ItemText: CommandItemTextPrimitive,
  Empty: CommandEmptyPrimitive,
  Status: CommandStatusPrimitive,
  Group: CommandGroupPrimitive,
  GroupLabel: CommandGroupLabelPrimitive,
  Separator: CommandSeparatorPrimitive,
};

const CommandDialog = CommandDialogPrimitive.Root;

const CommandDialogPortal = CommandDialogPrimitive.Portal;

const CommandCreateHandle = CommandDialogPrimitive.createHandle;

function CommandDialogTrigger(props: CommandDialogPrimitive.Trigger.Props) {
  return (
    <CommandDialogPrimitive.Trigger
      data-slot="command-dialog-trigger"
      {...props}
    />
  );
}

function CommandDialogBackdrop({
  className,
  ...props
}: CommandDialogPrimitive.Backdrop.Props) {
  return (
    <CommandDialogPrimitive.Backdrop
      className={cn(
        "fixed inset-0 z-50 bg-black/32 backdrop-blur-sm transition-opacity duration-200 ease-out data-ending-style:opacity-0 data-starting-style:opacity-0",
        className,
      )}
      data-slot="command-dialog-backdrop"
      {...props}
    />
  );
}

function CommandDialogViewport({
  className,
  ...props
}: CommandDialogPrimitive.Viewport.Props) {
  return (
    <CommandDialogPrimitive.Viewport
      className={cn(
        "fixed inset-0 z-50 flex flex-col items-center px-4 py-[max(--spacing(4),4vh)] sm:py-[10vh]",
        className,
      )}
      data-slot="command-dialog-viewport"
      {...props}
    />
  );
}

function CommandDialogPopup({
  className,
  children,
  instant = false,
  ...props
}: CommandDialogPrimitive.Popup.Props & { instant?: boolean }) {
  return (
    <CommandDialogPortal>
      <CommandDialogBackdrop
        className={cn(
          instant &&
            "transition-none data-starting-style:opacity-100 data-ending-style:opacity-100",
        )}
      />
      <CommandDialogViewport>
        <CommandDialogPrimitive.Popup
          className={cn(
            "relative row-start-2 flex max-h-105 min-h-0 w-full min-w-0 max-w-xl flex-col rounded-2xl border bg-popover not-dark:bg-clip-padding text-popover-foreground shadow-lg/5 outline-none transition-[scale,opacity,translate] duration-200 ease-out will-change-transform before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-2xl)-1px)] before:bg-muted/72 before:shadow-[0_1px_--theme(--color-black/4%)] data-ending-style:scale-98 data-starting-style:scale-98 data-ending-style:opacity-0 data-starting-style:opacity-0 **:data-[slot=scroll-area-viewport]:data-overflow-y:pe-1 dark:before:shadow-[0_-1px_--theme(--color-white/6%)]",
            instant &&
              "transition-none data-starting-style:scale-100 data-starting-style:opacity-100 data-ending-style:scale-100 data-ending-style:opacity-100",
            className,
          )}
          data-slot="command-dialog-popup"
          {...props}
        >
          {children}
        </CommandDialogPrimitive.Popup>
      </CommandDialogViewport>
    </CommandDialogPortal>
  );
}

/**
 * An inline search list. It filters by `contains`, as Baton's lists always did
 * (UI SDK defaults to fuzzy). `filter={null}` keeps every item, for results a
 * server already filtered. `display: contents` keeps the old layout: the root
 * used to render no element, so its children sat directly in the popup.
 */
function Command({
  className,
  filter,
  ...props
}: Omit<React.ComponentProps<typeof CommandRoot>, "filter"> & {
  filter?: SearchFilter<string> | null;
}) {
  return (
    <CommandRoot
      className={cn("contents", className)}
      filter={filter === null ? false : (filter ?? "contains")}
      {...props}
    />
  );
}

function CommandInput({
  className,
  placeholder,
  ...props
}: React.ComponentProps<typeof CommandInputPrimitive>) {
  // UI SDK warns about an unnamed field, and strict mode turns that into a
  // test failure. Callers pass a placeholder, never a label.
  const named = props["aria-label"] || props["aria-labelledby"];
  return (
    <div className="px-2.5 py-1.5">
      <div className="relative not-has-[>*.w-full]:w-fit w-full text-foreground has-disabled:opacity-64">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 start-px z-10 flex items-center ps-[calc(--spacing(3)-1px)] opacity-80 [&_svg:not([class*='size-'])]:size-4.5 sm:[&_svg:not([class*='size-'])]:size-4 [&_svg]:-mx-0.5"
          data-slot="command-start-addon"
        >
          <SearchIcon />
        </div>
        <CommandInputPrimitive
          autoFocus
          aria-label={named ? undefined : placeholder}
          className={cn(
            "*:data-[slot=command-input]:ps-[calc(--spacing(8.5)-1px)] sm:*:data-[slot=command-input]:ps-[calc(--spacing(8)-1px)]",
            "border-transparent! bg-transparent! shadow-none before:hidden has-focus-visible:ring-0",
            className,
          )}
          placeholder={placeholder}
          render={<Input nativeInput size="lg" />}
          {...props}
        />
      </div>
    </div>
  );
}

function CommandList({
  className,
  ...props
}: React.ComponentProps<typeof CommandListPrimitive>) {
  return (
    <ScrollArea scrollbarGutter scrollFade>
      <CommandListPrimitive
        className={cn(
          "not-empty:scroll-py-2 not-empty:p-2 in-data-overflow-y:pe-3",
          className,
        )}
        {...props}
      />
    </ScrollArea>
  );
}

function CommandEmpty({
  className,
  ...props
}: React.ComponentProps<typeof CommandEmptyPrimitive>) {
  return (
    <CommandEmptyPrimitive
      className={cn(
        "not-empty:p-2 text-center text-base text-muted-foreground not-empty:py-6 sm:text-sm",
        className,
      )}
      {...props}
    />
  );
}

function CommandPanel({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className="-mx-px not-has-[+[data-slot=command-footer]]:-mb-px relative min-h-0 rounded-t-xl not-has-[+[data-slot=command-footer]]:rounded-b-2xl border border-b-0 bg-popover bg-clip-padding shadow-xs/5 [clip-path:inset(0_1px)] not-has-[+[data-slot=command-footer]]:[clip-path:inset(0_1px_1px_1px_round_0_0_calc(var(--radius-2xl)-1px)_calc(var(--radius-2xl)-1px))] before:pointer-events-none before:absolute before:inset-0 before:rounded-t-[calc(var(--radius-xl)-1px)] **:data-[slot=scroll-area-scrollbar]:mt-2"
      {...props}
    />
  );
}

function CommandGroup({
  className,
  ...props
}: React.ComponentProps<typeof CommandGroupPrimitive>) {
  return (
    <CommandGroupPrimitive
      className={cn("[[role=group]+&]:mt-1.5", className)}
      {...props}
    />
  );
}

function CommandGroupLabel({
  className,
  ...props
}: React.ComponentProps<typeof CommandGroupLabelPrimitive>) {
  return (
    <CommandGroupLabelPrimitive
      className={cn(
        "px-2 py-1.5 font-medium text-muted-foreground text-xs",
        className,
      )}
      {...props}
    />
  );
}

/**
 * `value` identifies the item and is what `onAction` receives. Callers also
 * use it as the search text, so `label` defaults to it: UI SDK matches the
 * search against `label`, not `value`. Run it with `onSelect` (click or Enter).
 */
function CommandItem({
  className,
  value,
  label,
  ...props
}: Omit<React.ComponentProps<typeof CommandItemPrimitive>, "value"> & {
  value: string;
}) {
  return (
    <CommandItemPrimitive
      className={cn(
        "flex min-h-8 cursor-default select-none items-center rounded-sm px-2 py-1.5 text-base outline-none data-disabled:pointer-events-none data-highlighted:bg-accent data-highlighted:text-accent-foreground data-disabled:opacity-64 sm:min-h-7 sm:text-sm",
        className,
      )}
      label={label ?? value}
      value={value}
      {...props}
    />
  );
}

function CommandSeparator({
  className,
  ...props
}: React.ComponentProps<typeof CommandSeparatorPrimitive>) {
  return (
    <CommandSeparatorPrimitive
      className={cn("mx-2 my-2 h-px bg-border last:hidden", className)}
      {...props}
    />
  );
}

function CommandShortcut({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      className={cn(
        "ms-auto inline-flex shrink-0 items-center gap-1 font-medium font-sans text-muted-foreground/72 text-xs",
        className,
      )}
      data-slot="command-shortcut"
      {...props}
    />
  );
}

function CommandFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-2 rounded-b-[calc(var(--radius-2xl)-1px)] border-t px-5 py-3 text-muted-foreground text-xs",
        className,
      )}
      data-slot="command-footer"
      {...props}
    />
  );
}

export {
  Command,
  CommandCreateHandle,
  CommandDialog,
  CommandDialogPopup,
  CommandDialogTrigger,
  CommandEmpty,
  CommandFooter,
  CommandGroup,
  CommandGroupLabel,
  CommandInput,
  CommandItem,
  CommandList,
  CommandPanel,
  CommandPrimitive,
  CommandSeparator,
  CommandShortcut,
};
