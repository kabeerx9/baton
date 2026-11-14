"use client";

import { MenuContextTrigger as MenuContextTriggerPrimitive } from "@ui-sdk/react/menu";
import * as React from "react";

import {
  Menu,
  MenuCheckboxItem,
  MenuGroup,
  MenuGroupLabel,
  MenuItem,
  MenuPopup,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuShortcut,
  MenuSub,
  MenuSubPopup,
  MenuSubTrigger,
} from "./menu";

// A context menu is a menu with a different trigger: UI SDK opens a Menu from
// an area on a right click or a long press, anchored at the pointer, and every
// other part is the menu part. So this file re-exports the ported menu parts
// instead of repeating their classes, their event containment and their
// onClick-to-onSelect mapping.
//
// Slot names follow the UI SDK parts: `context-menu-content` is `menu-content`,
// `context-menu-item` is `menu-item`, and so on. The trigger's open state is
// `data-open`.

type TriggerProps = Omit<
  React.ComponentProps<typeof MenuContextTriggerPrimitive>,
  "children"
> & {
  asChild?: boolean;
  children?: React.ReactNode;
};

/** The area that opens the menu. Not a button: a div, as Base UI rendered. */
function ContextMenuTrigger({
  asChild = false,
  children,
  render,
  ...props
}: TriggerProps) {
  const resolvedRender =
    asChild && React.isValidElement<Record<string, any>>(children)
      ? children
      : render;

  return (
    <MenuContextTriggerPrimitive render={resolvedRender} {...props}>
      {asChild ? undefined : children}
    </MenuContextTriggerPrimitive>
  );
}

type ContentProps = React.ComponentProps<typeof MenuPopup>;

/**
 * The popup. It opens below and to the right of the pointer: a menu anchored at
 * a point has no width, so `align="center"` would center it on the pointer
 * instead of starting at it. `sideOffset` keeps the old 2px gap.
 */
function ContextMenuContent({
  align = "start",
  side = "bottom",
  sideOffset = 2,
  ...props
}: ContentProps) {
  return (
    <MenuPopup align={align} side={side} sideOffset={sideOffset} {...props} />
  );
}

export {
  Menu as ContextMenu,
  MenuCheckboxItem as ContextMenuCheckboxItem,
  ContextMenuContent,
  MenuGroup as ContextMenuGroup,
  MenuItem as ContextMenuItem,
  MenuGroupLabel as ContextMenuLabel,
  MenuRadioGroup as ContextMenuRadioGroup,
  MenuRadioItem as ContextMenuRadioItem,
  MenuSeparator as ContextMenuSeparator,
  MenuShortcut as ContextMenuShortcut,
  MenuSub as ContextMenuSub,
  MenuSubPopup as ContextMenuSubContent,
  MenuSubTrigger as ContextMenuSubTrigger,
  ContextMenuTrigger,
};
