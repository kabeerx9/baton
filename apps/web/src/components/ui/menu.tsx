"use client";

import {
  Menu as MenuPrimitive,
  MenuCheckboxItem as MenuCheckboxItemPrimitive,
  MenuContent as MenuContentPrimitive,
  MenuGroup as MenuGroupPrimitive,
  MenuGroupLabel as MenuGroupLabelPrimitive,
  MenuItem as MenuItemPrimitive,
  MenuItemIndicator as MenuItemIndicatorPrimitive,
  MenuRadioGroup as MenuRadioGroupPrimitive,
  MenuRadioItem as MenuRadioItemPrimitive,
  MenuSeparator as MenuSeparatorPrimitive,
  MenuShortcut as MenuShortcutPrimitive,
  MenuSub as MenuSubPrimitive,
  MenuSubContent as MenuSubContentPrimitive,
  MenuSubTrigger as MenuSubTriggerPrimitive,
  MenuTrigger as MenuTriggerPrimitive,
} from "@ui-sdk/react/menu";
import { ChevronRightIcon } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/cn";
import { containPopupEvents } from "./popup-containment";
import { POPUP_RESET } from "./popup-reset";

/** The trigger that last asked this menu to open, so the content can name it. */
const OpenerContext =
  React.createContext<React.RefObject<Element | null> | null>(null);

function Menu(props: React.ComponentProps<typeof MenuPrimitive>) {
  const opener = React.useRef<Element | null>(null);
  return (
    <OpenerContext.Provider value={opener}>
      <MenuPrimitive {...props} />
    </OpenerContext.Provider>
  );
}

/** The part's props with plain `children`: no part here takes a render function. */
type Plain<T> = Omit<T, "children"> & { children?: React.ReactNode };

function MenuTrigger({
  asChild = false,
  children,
  render,
  ...props
}: Plain<React.ComponentProps<typeof MenuTriggerPrimitive>> & {
  asChild?: boolean;
}) {
  const resolvedRender =
    asChild && React.isValidElement<Record<string, any>>(children)
      ? children
      : render;

  const opener = React.useContext(OpenerContext);
  const remember =
    <E extends React.SyntheticEvent>(handler?: (event: E) => void) =>
    (event: E) => {
      handler?.(event);
      if (opener) opener.current = event.currentTarget as Element;
    };

  return (
    <MenuTriggerPrimitive
      render={resolvedRender}
      {...props}
      onClick={remember(props.onClick)}
      onKeyDown={remember(props.onKeyDown)}
      onPointerDown={remember(props.onPointerDown)}
    >
      {asChild ? undefined : children}
    </MenuTriggerPrimitive>
  );
}

type ContentProps = Plain<React.ComponentProps<typeof MenuContentPrimitive>> & {
  /** Contain pointer and command events in the content. Keys always pass. */
  containEvents?: boolean;
};

/** The popup both the menu and a submenu use: one class list, one containment. */
function MenuContentShell({
  as: Content,
  children,
  className,
  containEvents = true,
  ...props
}: ContentProps & { as: typeof MenuContentPrimitive }) {
  return (
    <Content
      {...containPopupEvents(
        {
          className: cn(
            POPUP_RESET,
            "relative flex not-[class*='w-']:min-w-32 origin-(--transform-origin) rounded-lg border bg-popover not-dark:bg-clip-padding shadow-lg/5 outline-none transition-[scale,opacity,translate] duration-150 ease-out data-starting-style:scale-98 data-starting-style:opacity-0 data-ending-style:scale-98 data-ending-style:opacity-0 data-[side=top]:data-starting-style:translate-y-1 data-[side=bottom]:data-starting-style:-translate-y-1 data-[side=left]:data-starting-style:translate-x-1 data-[side=right]:data-starting-style:-translate-x-1 before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-lg)-1px)] before:shadow-[0_1px_--theme(--color-black/4%)] focus:outline-none dark:before:shadow-[0_-1px_--theme(--color-white/6%)]",
            className,
          ),
          children: (
            <div className="max-h-(--available-height) w-full overflow-y-auto p-1">
              {children}
            </div>
          ),
          ...props,
        },
        containEvents,
      )}
    />
  );
}

function MenuPopup({
  side = "bottom",
  align = "center",
  sideOffset = 4,
  ...props
}: ContentProps) {
  const opener = React.useContext(OpenerContext);
  return (
    <MenuContentShell
      align={align}
      as={MenuContentPrimitive}
      // UI SDK returns focus to the element focused before the menu opened
      // when the opener was not a recognised press: the card link for a status
      // menu opened by a bare click, and in Safari, where a click does not
      // focus a button. The menu button pattern, and Base UI, return to the
      // trigger. The default "trigger" setting does not do this, so name it.
      finalFocus={() => (opener?.current as HTMLElement | null) ?? undefined}
      side={side}
      sideOffset={sideOffset}
      {...props}
    />
  );
}

function MenuGroup(props: React.ComponentProps<typeof MenuGroupPrimitive>) {
  return <MenuGroupPrimitive {...props} />;
}

function MenuItem({
  className,
  inset,
  onClick,
  onSelect,
  variant = "default",
  ...props
}: Omit<Plain<React.ComponentProps<typeof MenuItemPrimitive>>, "onClick"> & {
  inset?: boolean;
  /**
   * Runs when the item is chosen by pointer or keyboard. It maps to UI SDK's
   * `onSelect`: a plain click handler would miss Enter and Space, which UI SDK
   * handles itself, and would still run on a disabled item. The result is not
   * returned, so a handler that returns a promise does not hold the menu open.
   */
  onClick?: (event: Event) => unknown;
  variant?: "default" | "destructive";
}) {
  return (
    <MenuItemPrimitive
      onSelect={(event) => {
        onSelect?.(event);
        if (!event.defaultPrevented) void onClick?.(event);
      }}
      className={cn(
        "[&>svg]:-mx-0.5 flex min-h-8 cursor-default select-none items-center gap-2 rounded-sm px-2 py-1 text-base text-foreground outline-none data-disabled:pointer-events-none data-highlighted:bg-accent data-inset:ps-8 data-[variant=destructive]:text-destructive-foreground data-highlighted:text-accent-foreground data-disabled:opacity-64 sm:min-h-7 sm:text-sm [&>svg:not([class*='opacity-'])]:opacity-80 [&>svg:not([class*='size-'])]:size-4.5 sm:[&>svg:not([class*='size-'])]:size-4 [&>svg]:pointer-events-none [&>svg]:shrink-0",
        className,
      )}
      data-inset={inset ? "" : undefined}
      data-variant={variant}
      destructive={variant === "destructive" || undefined}
      {...props}
    />
  );
}

function MenuCheckboxItem({
  className,
  children,
  variant = "default",
  ...props
}: Plain<React.ComponentProps<typeof MenuCheckboxItemPrimitive>> & {
  variant?: "default" | "switch";
}) {
  return (
    <MenuCheckboxItemPrimitive
      className={cn(
        "grid min-h-8 in-data-[side=none]:min-w-[calc(var(--anchor-width)+1.25rem)] cursor-default items-center gap-2 rounded-sm py-1 ps-2 text-base text-foreground outline-none data-disabled:pointer-events-none data-highlighted:bg-accent data-highlighted:text-accent-foreground data-disabled:opacity-64 sm:min-h-7 sm:text-sm [&_svg:not([class*='size-'])]:size-4.5 sm:[&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
        variant === "switch"
          ? "grid-cols-[1fr_auto] gap-4 pe-1.5"
          : "grid-cols-[1rem_1fr] pe-4",
        className,
      )}
      {...props}
    >
      {variant === "switch" ? (
        <>
          <span className="col-start-1">{children}</span>
          <MenuItemIndicatorPrimitive
            className="inset-shadow-[0_1px_--theme(--color-black/4%)] inline-flex h-[calc(var(--thumb-size)+2px)] w-[calc(var(--thumb-size)*2-2px)] shrink-0 items-center rounded-full p-px outline-none transition-[background-color,box-shadow] duration-200 [--thumb-size:--spacing(4)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background data-checked:bg-primary data-unchecked:bg-input data-disabled:opacity-64 sm:[--thumb-size:--spacing(3)]"
            keepMounted
          >
            <span className="pointer-events-none block aspect-square h-full in-[[data-slot=menu-checkbox-item][data-checked]]:origin-[var(--thumb-size)_50%] origin-left in-[[data-slot=menu-checkbox-item][data-checked]]:translate-x-[calc(var(--thumb-size)-4px)] in-[[data-slot=menu-checkbox-item]:active]:not-data-disabled:scale-x-110 in-[[data-slot=menu-checkbox-item]:active]:rounded-[var(--thumb-size)/calc(var(--thumb-size)*1.10)] rounded-(--thumb-size) bg-background shadow-sm/5 will-change-transform [transition:translate_.15s_var(--ease-out),border-radius_.15s_var(--ease-out),scale_.1s_.1s_var(--ease-out),transform-origin_.15s_var(--ease-out)]" />
          </MenuItemIndicatorPrimitive>
        </>
      ) : (
        <>
          <MenuItemIndicatorPrimitive className="col-start-1">
            <CheckMark />
          </MenuItemIndicatorPrimitive>
          <span className="col-start-2">{children}</span>
        </>
      )}
    </MenuCheckboxItemPrimitive>
  );
}

function CheckMark() {
  return (
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
  );
}

function MenuRadioGroup<T extends string = string>(
  props: React.ComponentProps<typeof MenuRadioGroupPrimitive<T>>,
) {
  return <MenuRadioGroupPrimitive {...props} />;
}

function MenuRadioItem({
  className,
  children,
  ...props
}: Plain<React.ComponentProps<typeof MenuRadioItemPrimitive>>) {
  return (
    <MenuRadioItemPrimitive
      className={cn(
        "grid min-h-8 in-data-[side=none]:min-w-[calc(var(--anchor-width)+1.25rem)] cursor-default grid-cols-[1rem_1fr] items-center gap-2 rounded-sm py-1 ps-2 pe-4 text-base text-foreground outline-none data-disabled:pointer-events-none data-highlighted:bg-accent data-highlighted:text-accent-foreground data-disabled:opacity-64 sm:min-h-7 sm:text-sm [&_svg:not([class*='size-'])]:size-4.5 sm:[&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0",
        className,
      )}
      {...props}
    >
      <MenuItemIndicatorPrimitive className="col-start-1">
        <CheckMark />
      </MenuItemIndicatorPrimitive>
      <span className="col-start-2">{children}</span>
    </MenuRadioItemPrimitive>
  );
}

function MenuGroupLabel({
  className,
  inset,
  ...props
}: React.ComponentProps<typeof MenuGroupLabelPrimitive> & {
  inset?: boolean;
}) {
  return (
    <MenuGroupLabelPrimitive
      className={cn(
        "px-2 py-1.5 font-medium text-muted-foreground text-xs data-inset:ps-9 sm:data-inset:ps-8",
        className,
      )}
      data-inset={inset ? "" : undefined}
      {...props}
    />
  );
}

function MenuSeparator({
  className,
  ...props
}: React.ComponentProps<typeof MenuSeparatorPrimitive>) {
  return (
    <MenuSeparatorPrimitive
      className={cn("mx-2 my-1 h-px bg-border", className)}
      {...props}
    />
  );
}

function MenuShortcut({
  className,
  ...props
}: React.ComponentProps<typeof MenuShortcutPrimitive>) {
  return (
    <MenuShortcutPrimitive
      className={cn(
        "ms-auto inline-flex shrink-0 items-center gap-1 font-medium font-sans text-muted-foreground/72 text-xs",
        className,
      )}
      {...props}
    />
  );
}

const MenuSub = MenuSubPrimitive;

function MenuSubTrigger({
  className,
  inset,
  children,
  ...props
}: Plain<React.ComponentProps<typeof MenuSubTriggerPrimitive>> & {
  inset?: boolean;
}) {
  return (
    <MenuSubTriggerPrimitive
      className={cn(
        "flex min-h-8 items-center gap-2 rounded-sm px-2 py-1 text-base text-foreground outline-none data-disabled:pointer-events-none data-highlighted:bg-accent data-open:bg-accent data-popup-open:bg-accent data-inset:ps-8 data-highlighted:text-accent-foreground data-open:text-accent-foreground data-popup-open:text-accent-foreground data-disabled:opacity-64 sm:min-h-7 sm:text-sm [&_svg:not([class*='size-'])]:size-4.5 sm:[&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none",
        className,
      )}
      data-inset={inset ? "" : undefined}
      {...props}
    >
      {children}
      <ChevronRightIcon
        aria-hidden="true"
        className="-me-0.5 ms-auto opacity-80"
      />
    </MenuSubTriggerPrimitive>
  );
}

function MenuSubPopup({
  align = "start",
  alignOffset,
  sideOffset = 0,
  ...props
}: ContentProps) {
  // The content has a 1px border and the list p-1, so -5 lines the first item
  // up with its trigger. UI SDK's own default lines up the content's edge, which
  // left the first item 4px low.
  return (
    <MenuContentShell
      align={align}
      alignOffset={alignOffset ?? (align !== "center" ? -5 : undefined)}
      as={MenuSubContentPrimitive}
      sideOffset={sideOffset}
      {...props}
    />
  );
}

export {
  Menu,
  Menu as DropdownMenu,
  MenuCheckboxItem,
  MenuCheckboxItem as DropdownMenuCheckboxItem,
  MenuGroup,
  MenuGroup as DropdownMenuGroup,
  MenuGroupLabel,
  MenuGroupLabel as DropdownMenuLabel,
  MenuItem,
  MenuItem as DropdownMenuItem,
  MenuPopup,
  MenuPopup as DropdownMenuContent,
  MenuRadioGroup,
  MenuRadioGroup as DropdownMenuRadioGroup,
  MenuRadioItem,
  MenuRadioItem as DropdownMenuRadioItem,
  MenuSeparator,
  MenuSeparator as DropdownMenuSeparator,
  MenuShortcut,
  MenuShortcut as DropdownMenuShortcut,
  MenuSub,
  MenuSub as DropdownMenuSub,
  MenuSubPopup,
  MenuSubPopup as DropdownMenuSubContent,
  MenuSubTrigger,
  MenuSubTrigger as DropdownMenuSubTrigger,
  MenuTrigger,
  MenuTrigger as DropdownMenuTrigger,
};
