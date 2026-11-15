"use client";

import {
  AlertDialogBackdrop as AlertDialogBackdropPrimitive,
  AlertDialogClose as AlertDialogClosePrimitive,
  AlertDialogContent as AlertDialogContentPrimitive,
  AlertDialogDescription as AlertDialogDescriptionPrimitive,
  createAlertDialogController,
  AlertDialog as AlertDialogRootPrimitive,
  type AlertDialogController,
  AlertDialogTitle as AlertDialogTitlePrimitive,
  AlertDialogTrigger as AlertDialogTriggerPrimitive,
} from "@ui-sdk/react/alert-dialog";
import type {
  DialogFinalFocus,
  DialogInitialFocus,
} from "@ui-sdk/react/dialog";
import * as React from "react";

import { cn } from "@/lib/cn";
import { containPopupEvents } from "./popup-containment";
import { POPUP_RESET } from "./popup-reset";

/**
 * What `AlertDialogCreateHandle()` returns. It keeps the Base UI handle API
 * (`open(triggerId)`, `openWithPayload(payload)`, `close()`, `isOpen`) over a
 * UI SDK controller, so a caller passes it as `handle` to the alert dialog and
 * to detached triggers.
 */
type AlertDialogHandle<Payload = unknown> = {
  readonly controller: AlertDialogController<Payload>;
  /** Opens the dialog, associated with the trigger with this id. `null` opens it alone. */
  open: (triggerId: string | null) => void;
  openWithPayload: (payload: Payload) => void;
  close: () => void;
  readonly isOpen: boolean;
  /** Trigger payloads by id, kept so `open(triggerId)` can pass one. */
  readonly triggers: Map<string, Payload | undefined>;
};

function AlertDialogCreateHandle<
  Payload = unknown,
>(): AlertDialogHandle<Payload> {
  const controller = createAlertDialogController<Payload>();
  const triggers = new Map<string, Payload | undefined>();
  return {
    controller,
    triggers,
    open(triggerId) {
      void controller.open({
        payload: triggerId === null ? undefined : triggers.get(triggerId),
      });
    },
    openWithPayload(payload) {
      void controller.open({ payload });
    },
    close() {
      // Base UI ignored this before the root was mounted; UI SDK warns, and a
      // caller's unmount cleanup closes a dialog that may be closed already.
      if (controller.isOpen()) controller.close();
    },
    get isOpen() {
      return Boolean(controller.isOpen());
    },
  };
}

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

function AlertDialog({
  handle,
  controller,
  ...props
}: React.ComponentProps<typeof AlertDialogRootPrimitive> & {
  /** A handle from `AlertDialogCreateHandle()`; maps to UI SDK `controller`. */
  handle?: AlertDialogHandle<any>;
}) {
  return (
    <AlertDialogRootPrimitive
      controller={handle?.controller ?? controller}
      {...props}
    />
  );
}

/** UI SDK dialogs render in place and have no portal: this renders its children. */
function AlertDialogPortal({ children }: { children?: React.ReactNode }) {
  return <>{children}</>;
}

function AlertDialogTrigger({
  handle,
  controller,
  id,
  payload,
  ...props
}: React.ComponentProps<typeof AlertDialogTriggerPrimitive> & {
  /** A handle from `AlertDialogCreateHandle()`; maps to UI SDK `controller`. */
  handle?: AlertDialogHandle<any>;
}) {
  React.useEffect(() => {
    if (!handle || !id) return;
    handle.triggers.set(id, payload);
    return () => {
      handle.triggers.delete(id);
    };
  }, [handle, id, payload]);

  return (
    <AlertDialogTriggerPrimitive
      controller={handle?.controller ?? controller}
      id={id}
      payload={payload}
      {...props}
    />
  );
}

function AlertDialogBackdrop({
  className,
  containEvents = true,
  ...props
}: React.ComponentProps<typeof AlertDialogBackdropPrimitive> & {
  /** Contain pointer and command events in the backdrop. Keys always pass. */
  containEvents?: boolean;
}) {
  return (
    <AlertDialogBackdropPrimitive
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

/** UI SDK dialogs have no viewport: the content is placed by its own classes. */
function AlertDialogViewport({ children }: { children?: React.ReactNode }) {
  return <>{children}</>;
}

function AlertDialogPopup({
  className,
  bottomStickOnMobile = true,
  containEvents = true,
  initialFocus,
  finalFocus,
  ...props
}: Omit<
  React.ComponentProps<typeof AlertDialogContentPrimitive>,
  "initialFocus" | "finalFocus"
> & {
  bottomStickOnMobile?: boolean;
  /** Contain pointer and command events in the content and the backdrop. Keys always pass. */
  containEvents?: boolean;
  /** Also takes a ref object (mapped to a function) and `false` (mapped to "none"). */
  initialFocus?: DialogInitialFocus | FocusRef | boolean;
  /** Also takes a ref object (mapped to a function) and `false` (mapped to "none"). */
  finalFocus?: DialogFinalFocus | FocusRef | boolean;
}) {
  return (
    <>
      <AlertDialogBackdrop containEvents={containEvents} />
      <AlertDialogContentPrimitive
        {...containPopupEvents(
          {
            // The content is the top-layer element itself, so it is placed here
            // and not by a viewport grid. The default centers it a quarter of
            // the free height from the top, as the viewport's 1fr/auto/3fr rows
            // did. Below sm it sticks to the bottom.
            className: cn(
              POPUP_RESET,
              "fixed inset-x-0 top-[25%] mx-auto my-0 flex max-h-[calc(100dvh-2rem)] min-h-0 w-[calc(100%-2rem)] min-w-0 max-w-lg -translate-y-1/4 flex-col overflow-visible rounded-2xl border bg-popover p-0 not-dark:bg-clip-padding text-popover-foreground shadow-lg/5 transition-[scale,opacity,translate] duration-200 ease-out will-change-transform before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-2xl)-1px)] before:shadow-[0_1px_--theme(--color-black/4%)] data-ending-style:scale-98 data-starting-style:scale-98 data-ending-style:opacity-0 data-starting-style:opacity-0 dark:before:shadow-[0_-1px_--theme(--color-white/6%)]",
              bottomStickOnMobile &&
                "max-sm:top-auto max-sm:bottom-0 max-sm:max-h-[calc(100dvh-3rem)] max-sm:w-full max-sm:max-w-none max-sm:translate-y-0 max-sm:rounded-none max-sm:border-x-0 max-sm:border-t max-sm:border-b-0 max-sm:data-ending-style:translate-y-4 max-sm:data-starting-style:translate-y-4 max-sm:before:hidden max-sm:before:rounded-none",
              className,
            ),
            initialFocus: mapFocus(initialFocus),
            finalFocus: mapFocus(finalFocus),
            ...props,
          },
          containEvents,
        )}
      />
    </>
  );
}

function AlertDialogHeader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 p-6 text-center max-sm:pb-4 sm:text-left",
        className,
      )}
      data-slot="alert-dialog-header"
      {...props}
    />
  );
}

function AlertDialogFooter({
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
        variant === "bare" && "pb-6",
        className,
      )}
      data-slot="alert-dialog-footer"
      {...props}
    />
  );
}

function AlertDialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogTitlePrimitive>) {
  return (
    <AlertDialogTitlePrimitive
      className={cn(
        "font-heading font-semibold text-xl leading-none",
        className,
      )}
      {...props}
    />
  );
}

function AlertDialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof AlertDialogDescriptionPrimitive>) {
  return (
    <AlertDialogDescriptionPrimitive
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  );
}

function AlertDialogClose(
  props: React.ComponentProps<typeof AlertDialogClosePrimitive>,
) {
  return <AlertDialogClosePrimitive {...props} />;
}

export {
  AlertDialog,
  AlertDialogBackdrop,
  AlertDialogBackdrop as AlertDialogOverlay,
  AlertDialogClose,
  AlertDialogCreateHandle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogPopup,
  AlertDialogPopup as AlertDialogContent,
  AlertDialogPortal,
  AlertDialogTitle,
  AlertDialogTrigger,
  AlertDialogViewport,
};

export type { AlertDialogHandle };
