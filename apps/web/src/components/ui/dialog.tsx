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
import { DialogCreateHandle, type DialogHandle } from "./dialog-handle";
import { containPopupEvents } from "./popup-containment";
import { POPUP_RESET } from "./popup-reset";

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

function Dialog({
  handle,
  controller,
  disablePointerDismissal,
  closeOnOutsidePress,
  ...props
}: React.ComponentProps<typeof DialogRootPrimitive> & {
  /** A handle from `DialogCreateHandle()`; maps to UI SDK `controller`. */
  handle?: DialogHandle<any>;
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
      controller={handle?.controller ?? controller}
      {...props}
    />
  );
}

function DialogTrigger({
  asChild = false,
  children,
  handle,
  controller,
  id,
  payload,
  render,
  ...props
}: Plain<React.ComponentProps<typeof DialogTriggerPrimitive>> & {
  asChild?: boolean;
  /** A handle from `DialogCreateHandle()`; maps to UI SDK `controller`. */
  handle?: DialogHandle<any>;
}) {
  const resolvedRender = (
    asChild && React.isValidElement(children) ? children : render
  ) as React.ComponentProps<typeof DialogTriggerPrimitive>["render"];

  React.useEffect(() => {
    if (!handle || !id) return;
    handle.triggers.set(id, payload);
    return () => {
      handle.triggers.delete(id);
    };
  }, [handle, id, payload]);

  return (
    <DialogTriggerPrimitive
      controller={handle?.controller ?? controller}
      id={id}
      payload={payload}
      render={resolvedRender}
      {...props}
    >
      {asChild ? undefined : children}
    </DialogTriggerPrimitive>
  );
}

function DialogClose({
  asChild = false,
  children,
  render,
  ...props
}: Plain<React.ComponentProps<typeof DialogClosePrimitive>> & {
  asChild?: boolean;
}) {
  const resolvedRender = (
    asChild && React.isValidElement(children) ? children : render
  ) as React.ComponentProps<typeof DialogClosePrimitive>["render"];

  return (
    <DialogClosePrimitive render={resolvedRender} {...props}>
      {asChild ? undefined : children}
    </DialogClosePrimitive>
  );
}

function DialogBackdrop({
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
            "fixed inset-0 z-50 m-0 size-full max-h-none max-w-none border-0 bg-black/50 p-0 backdrop-blur-[6px] transition-opacity duration-200 ease-out data-ending-style:opacity-0 data-starting-style:opacity-0",
            className,
          ),
          ...props,
        },
        containEvents,
      )}
    />
  );
}

function DialogPopup({
  className,
  children,
  showCloseButton = true,
  bottomStickOnMobile = true,
  instant = false,
  containEvents = true,
  initialFocus,
  finalFocus,
  ...props
}: Omit<
  Plain<React.ComponentProps<typeof DialogContentPrimitive>>,
  "initialFocus" | "finalFocus"
> & {
  showCloseButton?: boolean;
  bottomStickOnMobile?: boolean;
  instant?: boolean;
  /** Contain pointer and command events in the content and the backdrop. Keys always pass. */
  containEvents?: boolean;
  /** Also takes a ref object (mapped to a function) and `false` (mapped to "none"). */
  initialFocus?: DialogInitialFocus | FocusRef | boolean;
  /** Also takes a ref object (mapped to a function) and `false` (mapped to "none"). */
  finalFocus?: DialogFinalFocus | FocusRef | boolean;
}) {
  return (
    <>
      <DialogBackdrop
        containEvents={containEvents}
        className={cn(
          instant &&
            "transition-none data-starting-style:opacity-100 data-ending-style:opacity-100",
        )}
      />
      <DialogContentPrimitive
        {...containPopupEvents(
          {
            // The content is the top-layer element itself, so it is placed here
            // and not by a viewport grid. The default centers it a quarter of
            // the free height from the top, as the viewport's 1fr/auto/3fr rows
            // did. Below sm it sticks to the bottom.
            className: cn(
              POPUP_RESET,
              "fixed inset-x-0 top-[25%] mx-auto my-0 flex max-h-[calc(100dvh-2rem)] min-h-0 w-[calc(100%-2rem)] min-w-0 max-w-lg -translate-y-1/4 flex-col overflow-visible rounded-2xl border bg-popover p-0 not-dark:bg-clip-padding shadow-lg/5 transition-[scale,opacity,translate] duration-200 ease-out will-change-transform before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-2xl)-1px)] before:shadow-[0_1px_--theme(--color-black/4%)] data-ending-style:scale-98 data-starting-style:scale-98 data-ending-style:opacity-0 data-starting-style:opacity-0 dark:before:shadow-[0_-1px_--theme(--color-white/6%)]",
              // `w-auto` from a caller means "fit the content", which a fixed
              // element with both insets set would not do on its own.
              "[&.w-auto]:w-fit",
              bottomStickOnMobile &&
                "max-sm:top-auto max-sm:bottom-0 max-sm:max-h-[calc(100dvh-3rem)] max-sm:w-full max-sm:max-w-none max-sm:translate-y-0 max-sm:rounded-none max-sm:border-x-0 max-sm:border-t max-sm:border-b-0 max-sm:data-ending-style:translate-y-4 max-sm:data-starting-style:translate-y-4 max-sm:before:hidden max-sm:before:rounded-none",
              instant &&
                "transition-none data-starting-style:scale-100 data-starting-style:opacity-100 data-ending-style:scale-100 data-ending-style:opacity-100 max-sm:data-starting-style:translate-y-0 max-sm:data-ending-style:translate-y-0",
              className,
            ),
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
    </>
  );
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 p-6 in-[[data-slot=dialog-content]:has([data-slot=dialog-panel])]:pb-3 max-sm:pb-4",
        className,
      )}
      data-slot="dialog-header"
      {...props}
    />
  );
}

function DialogFooter({
  className,
  variant = "default",
  ...props
}: React.ComponentProps<"div"> & {
  variant?: "default" | "bare";
}) {
  return (
    <div
      className={cn(
        "flex flex-col-reverse gap-2 px-6 sm:flex-row sm:justify-end sm:rounded-b-[calc(var(--radius-2xl)-1px)]",
        variant === "default" && "border-t bg-muted/72 py-4",
        variant === "bare" &&
          "in-[[data-slot=dialog-content]:has([data-slot=dialog-panel])]:pt-3 pt-4 pb-6",
        className,
      )}
      data-slot="dialog-footer"
      {...props}
    />
  );
}

function DialogTitle({
  asChild = false,
  className,
  children,
  render,
  ...props
}: Plain<React.ComponentProps<typeof DialogTitlePrimitive>> & {
  asChild?: boolean;
}) {
  const resolvedRender = (
    asChild && React.isValidElement(children) ? children : render
  ) as React.ComponentProps<typeof DialogTitlePrimitive>["render"];

  return (
    <DialogTitlePrimitive
      className={cn(
        "font-heading font-semibold text-xl leading-none",
        className,
      )}
      render={resolvedRender}
      {...props}
    >
      {asChild ? undefined : children}
    </DialogTitlePrimitive>
  );
}

function DialogDescription({
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

function DialogPanel({
  className,
  scrollFade = true,
  ...props
}: React.ComponentProps<"div"> & { scrollFade?: boolean }) {
  return (
    <ScrollArea scrollFade={scrollFade}>
      <div
        className={cn(
          "p-6 in-[[data-slot=dialog-content]:has([data-slot=dialog-header])]:pt-1 in-[[data-slot=dialog-content]:has([data-slot=dialog-footer]:not(.border-t))]:pb-1",
          className,
        )}
        data-slot="dialog-panel"
        {...props}
      />
    </ScrollArea>
  );
}

/**
 * The unstyled parts, for a feature that places its own dialog (the shortcuts
 * panel is a non-modal side panel). They keep the UI SDK behavior and slots.
 */
const DialogPrimitive = {
  Root: Dialog,
  Trigger: DialogTrigger,
  Backdrop: DialogBackdropPrimitive,
  Content: DialogContentPrimitive,
  Title: DialogTitlePrimitive,
  Description: DialogDescriptionPrimitive,
  Close: DialogClose,
};

export {
  Dialog,
  DialogBackdrop,
  DialogClose,
  DialogCreateHandle,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogPopup as DialogContent,
  DialogPrimitive,
  DialogTitle,
  DialogTrigger,
};

export type { DialogHandle };
