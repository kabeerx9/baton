"use client";

import {
  Dialog as DialogRootPrimitive,
  DialogBackdrop as DialogBackdropPrimitive,
  DialogClose as DialogClosePrimitive,
  DialogContent as DialogContentPrimitive,
  DialogDescription as DialogDescriptionPrimitive,
  type DialogFinalFocus,
  type DialogInitialFocus,
  DialogTitle as DialogTitlePrimitive,
  DialogTrigger as DialogTriggerPrimitive,
} from "@ui-sdk/react/dialog";
import { XIcon } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/cn";
import { i18n } from "@/lib/i18n";
import { containPopupEvents } from "./popup-containment";
import { POPUP_RESET } from "./popup-reset";

/**
 * A side panel built on UI SDK's Dialog: the same modal behavior, styled to
 * slide in from one edge. Not UI SDK's Drawer, which is a swipe sheet with
 * snap points.
 */

type Side = "right" | "left" | "top" | "bottom";

/** The part's props with plain `children`: no part here takes a render function. */
type Plain<T> = Omit<T, "children"> & { children?: React.ReactNode };

/** A ref object, which Base UI took for `initialFocus` and `finalFocus`. */
type FocusRef = React.RefObject<HTMLElement | null>;

/** Base UI's focus props mapped to UI SDK's: `false` to "none", a ref to a function. */
function mapFocus(
  value: DialogInitialFocus | FocusRef | boolean | undefined,
): DialogInitialFocus | undefined {
  if (value === false) return "none";
  if (value === true || value === undefined) return undefined;
  if (typeof value === "object" && "current" in value) {
    return () => value.current;
  }
  return value;
}

function Sheet({
  closeOnOutsidePress,
  disablePointerDismissal,
  ...props
}: React.ComponentProps<typeof DialogRootPrimitive> & {
  /** Base UI name for `closeOnOutsidePress={false}`. */
  disablePointerDismissal?: boolean;
}) {
  return (
    <DialogRootPrimitive
      closeOnOutsidePress={
        closeOnOutsidePress ??
        (disablePointerDismissal === undefined
          ? undefined
          : !disablePointerDismissal)
      }
      {...props}
    />
  );
}

/** UI SDK dialogs render in place and have no portal: this renders its children. */
function SheetPortal({ children }: { children?: React.ReactNode }) {
  return <>{children}</>;
}

function SheetTrigger(
  props: React.ComponentProps<typeof DialogTriggerPrimitive>,
) {
  return <DialogTriggerPrimitive {...props} />;
}

function SheetClose(props: React.ComponentProps<typeof DialogClosePrimitive>) {
  return <DialogClosePrimitive {...props} />;
}

function SheetBackdrop({
  className,
  containEvents = true,
  ...props
}: React.ComponentProps<typeof DialogBackdropPrimitive> & {
  /** Contain pointer and command events in the backdrop. Keys always pass. */
  containEvents?: boolean;
}) {
  return (
    <DialogBackdropPrimitive
      {...containPopupEvents(
        {
          className: cn(
            "fixed inset-0 z-50 m-0 size-full max-h-none max-w-none border-0 bg-black/32 p-0 backdrop-blur-sm transition-opacity duration-200 ease-out data-ending-style:opacity-0 data-starting-style:opacity-0",
            className,
          ),
          ...props,
        },
        containEvents,
      )}
    />
  );
}

/**
 * UI SDK positions the content itself, so the viewport only holds the part.
 * It stays local: no caller imports it, and UI SDK has no such part.
 */
function SheetViewport({ children }: { children?: React.ReactNode }) {
  return <>{children}</>;
}

/** Where the panel sits and which way it slides. */
const SIDE_CLASS: Record<Side, string> = {
  bottom:
    "inset-x-0 bottom-0 border-t data-ending-style:translate-y-8 data-starting-style:translate-y-8",
  top: "inset-x-0 top-0 border-b data-ending-style:-translate-y-8 data-starting-style:-translate-y-8",
  left: "inset-y-0 left-0 w-[calc(100%-(--spacing(12)))] max-w-md border-e data-ending-style:-translate-x-8 data-starting-style:-translate-x-8",
  right:
    "inset-y-0 right-0 w-[calc(100%-(--spacing(12)))] max-w-md border-s data-ending-style:translate-x-8 data-starting-style:translate-x-8",
};

/** An inset panel keeps a gap from the edge of the window on wider screens. */
const INSET_CLASS: Record<Side, string> = {
  bottom: "sm:inset-x-4 sm:bottom-4",
  top: "sm:inset-x-4 sm:top-4",
  left: "sm:inset-y-4 sm:left-4",
  right: "sm:inset-y-4 sm:right-4",
};

function SheetPopup({
  className,
  children,
  showCloseButton = true,
  side = "right",
  variant = "default",
  containEvents = true,
  initialFocus,
  finalFocus,
  ...props
}: Omit<
  Plain<React.ComponentProps<typeof DialogContentPrimitive>>,
  "initialFocus" | "finalFocus"
> & {
  showCloseButton?: boolean;
  side?: Side;
  variant?: "default" | "inset";
  /** Contain pointer and command events in the content and the backdrop. Keys always pass. */
  containEvents?: boolean;
  /** Also takes a ref object (mapped to a function) and `false` (mapped to "none"). */
  initialFocus?: DialogInitialFocus | FocusRef | boolean;
  /** Also takes a ref object (mapped to a function) and `false` (mapped to "none"). */
  finalFocus?: DialogFinalFocus | FocusRef | boolean;
}) {
  return (
    <SheetPortal>
      <SheetBackdrop containEvents={containEvents} />
      <SheetViewport>
        <DialogContentPrimitive
          {...containPopupEvents(
            {
              // The content is the top-layer element itself, so it is placed
              // here: no viewport grid, no inline styles.
              className: cn(
                POPUP_RESET,
                "fixed z-50 flex max-h-full min-h-0 min-w-0 flex-col bg-popover text-popover-foreground shadow-lg/5 transition-[opacity,translate] duration-200 ease-out will-change-transform before:pointer-events-none before:absolute before:inset-0 before:shadow-[0_1px_--theme(--color-black/4%)] data-ending-style:opacity-0 data-starting-style:opacity-0 max-sm:before:hidden dark:before:shadow-[0_-1px_--theme(--color-white/6%)]",
                SIDE_CLASS[side],
                variant === "inset" &&
                  cn(
                    "before:hidden sm:rounded-2xl sm:border sm:before:rounded-[calc(var(--radius-2xl)-1px)] sm:**:data-[slot=sheet-footer]:rounded-b-[calc(var(--radius-2xl)-1px)]",
                    INSET_CLASS[side],
                  ),
                className,
              ),
              // The sheet keeps its own identity now that the part owns the
              // `dialog-content` slot.
              "data-sheet": "",
              "data-side": side,
              finalFocus: mapFocus(finalFocus),
              initialFocus: mapFocus(initialFocus),
              ...props,
              children: (
                <>
                  {children}
                  {showCloseButton && (
                    <DialogClosePrimitive
                      aria-label={i18n.t("common:actions.close")}
                      className="absolute end-2 top-2"
                      render={<Button size="icon" variant="ghost" />}
                    >
                      <XIcon />
                    </DialogClosePrimitive>
                  )}
                </>
              ),
            },
            containEvents,
          )}
        />
      </SheetViewport>
    </SheetPortal>
  );
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 p-6 in-[[data-sheet]:has([data-slot=sheet-panel])]:pb-3 max-sm:pb-4",
        className,
      )}
      data-slot="sheet-header"
      {...props}
    />
  );
}

function SheetFooter({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<"div"> & {
  variant?: "default" | "bare";
}) {
  return (
    <div
      className={cn(
        "flex flex-col-reverse gap-2 px-6 sm:flex-row sm:justify-end",
        variant === "default" && "border-t bg-muted/72 py-4",
        variant === "bare" &&
          "in-[[data-sheet]:has([data-slot=sheet-panel])]:pt-3 pt-4 pb-6",
        className,
      )}
      data-slot="sheet-footer"
      {...props}
    />
  );
}

function SheetTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogTitlePrimitive>) {
  return (
    <DialogTitlePrimitive
      className={cn(
        "font-heading font-semibold text-xl leading-none",
        className,
      )}
      {...props}
    />
  );
}

function SheetDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogDescriptionPrimitive>) {
  return (
    <DialogDescriptionPrimitive
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  );
}

function SheetPanel({
  className,
  scrollFade = true,
  ...props
}: React.ComponentProps<"div"> & { scrollFade?: boolean }) {
  return (
    <ScrollArea scrollFade={scrollFade}>
      <div
        className={cn(
          "p-6 in-[[data-sheet]:has([data-slot=sheet-header])]:pt-1 in-[[data-sheet]:has([data-slot=sheet-footer]:not(.border-t))]:pb-1",
          className,
        )}
        data-slot="sheet-panel"
        {...props}
      />
    </ScrollArea>
  );
}

export {
  Sheet,
  SheetBackdrop,
  SheetBackdrop as SheetOverlay,
  SheetClose,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetPanel,
  SheetPopup,
  SheetPopup as SheetContent,
  SheetPortal,
  SheetTitle,
  SheetTrigger,
};
