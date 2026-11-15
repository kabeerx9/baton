"use client";

import {
  createPopoverController,
  Popover as PopoverPrimitive,
  PopoverClose as PopoverClosePrimitive,
  PopoverContent as PopoverContentPrimitive,
  PopoverDescription as PopoverDescriptionPrimitive,
  type PopoverController,
  PopoverTitle as PopoverTitlePrimitive,
  PopoverTrigger as PopoverTriggerPrimitive,
} from "@ui-sdk/react/popover";
import * as React from "react";

import { cn } from "@/lib/cn";
import { keepOuterFormUnsubmitted } from "./outer-form-guard";
import { containPopupEvents } from "./popup-containment";
import { POPUP_RESET } from "./popup-reset";

/** The part's props with plain `children`: no part here takes a render function. */
type Plain<T> = Omit<T, "children"> & { children?: React.ReactNode };

/**
 * What `PopoverCreateHandle()` returns. It keeps the Base UI handle API
 * (`open(triggerId)`, `close()`, `isOpen`) over a UI SDK controller, so a
 * caller passes it as `handle` to the popover and to detached triggers.
 */
type PopoverHandle<Payload = unknown> = {
  readonly controller: PopoverController<Payload>;
  /** Opens the popover from the detached trigger with this id. */
  open: (triggerId: string) => void;
  close: () => void;
  readonly isOpen: boolean;
  /** Trigger payloads by id, kept so `open(triggerId)` can pass one. */
  readonly triggers: Map<string, Payload | undefined>;
};

function PopoverCreateHandle<Payload = unknown>(): PopoverHandle<Payload> {
  const controller = createPopoverController<Payload>();
  const triggers = new Map<string, Payload | undefined>();
  return {
    controller,
    triggers,
    open(triggerId) {
      void controller.open({
        anchor: document.getElementById(triggerId) ?? undefined,
        payload: triggers.get(triggerId),
      });
    },
    close() {
      controller.close();
    },
    get isOpen() {
      return controller.isOpen();
    },
  };
}

function Popover({
  handle,
  controller,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive> & {
  /** A handle from `PopoverCreateHandle()`; maps to UI SDK `controller`. */
  handle?: PopoverHandle<any>;
}) {
  return (
    <PopoverPrimitive
      controller={handle?.controller ?? controller}
      {...props}
    />
  );
}

function PopoverTrigger({
  asChild = false,
  children,
  handle,
  controller,
  id,
  payload,
  render,
  ...props
}: Plain<React.ComponentProps<typeof PopoverTriggerPrimitive>> & {
  asChild?: boolean;
  /** A handle from `PopoverCreateHandle()`; maps to UI SDK `controller`. */
  handle?: PopoverHandle<any>;
}) {
  const resolvedRender = (
    asChild && React.isValidElement(children) ? children : render
  ) as React.ComponentProps<typeof PopoverTriggerPrimitive>["render"];

  React.useEffect(() => {
    if (!handle || !id) return;
    handle.triggers.set(id, payload);
    return () => {
      handle.triggers.delete(id);
    };
  }, [handle, id, payload]);

  return (
    <PopoverTriggerPrimitive
      controller={handle?.controller ?? controller}
      id={id}
      payload={payload}
      render={resolvedRender}
      {...props}
    >
      {asChild ? undefined : children}
    </PopoverTriggerPrimitive>
  );
}

function PopoverPopup({
  children,
  className,
  side = "bottom",
  align = "center",
  sideOffset = 4,
  alignOffset = 0,
  tooltipStyle = false,
  positionerClassName,
  containEvents = true,
  onClick,
  onKeyDown,
  ...props
}: Plain<React.ComponentProps<typeof PopoverContentPrimitive>> & {
  tooltipStyle?: boolean;
  /** UI SDK has no positioner: the class lands on the content. */
  positionerClassName?: string;
  /** Contain pointer and command events in the content. Keys always pass. */
  containEvents?: boolean;
}) {
  return (
    <PopoverContentPrimitive
      {...containPopupEvents(
        {
          align,
          alignOffset,
          className: cn(
            POPUP_RESET,
            "relative flex max-w-(--available-width) origin-(--transform-origin) rounded-lg border bg-popover not-dark:bg-clip-padding shadow-lg/5 outline-none transition-[scale,opacity,translate] duration-150 ease-out before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-lg)-1px)] before:shadow-[0_1px_--theme(--color-black/4%)] has-data-[slot=calendar]:rounded-xl has-data-[slot=calendar]:before:rounded-[calc(var(--radius-xl)-1px)] data-starting-style:scale-98 data-starting-style:opacity-0 data-ending-style:scale-98 data-ending-style:opacity-0 data-[side=top]:data-starting-style:translate-y-1 data-[side=bottom]:data-starting-style:-translate-y-1 data-[side=left]:data-starting-style:translate-x-1 data-[side=right]:data-starting-style:-translate-x-1 dark:before:shadow-[0_-1px_--theme(--color-white/6%)]",
            tooltipStyle &&
              "w-fit text-balance rounded-md text-xs shadow-md/5 before:rounded-[calc(var(--radius-md)-1px)]",
            positionerClassName,
            className,
          ),
          onClick: (event: React.MouseEvent<HTMLDivElement>) => {
            onClick?.(event);
            keepOuterFormUnsubmitted(event);
          },
          onKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => {
            onKeyDown?.(event);
            keepOuterFormUnsubmitted(event);
          },
          side,
          sideOffset,
          children: (
            <div
              className={cn(
                "relative size-full max-h-(--available-height) overflow-y-auto px-1 py-0.5 has-data-[slot=calendar]:p-2",
                tooltipStyle && "overflow-clip",
              )}
              data-slot="popover-viewport"
            >
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

function PopoverClose(
  props: Plain<React.ComponentProps<typeof PopoverClosePrimitive>>,
) {
  return <PopoverClosePrimitive type="button" {...props} />;
}

function PopoverTitle({
  className,
  ...props
}: React.ComponentProps<typeof PopoverTitlePrimitive>) {
  return (
    <PopoverTitlePrimitive
      className={cn("font-semibold text-lg leading-none", className)}
      {...props}
    />
  );
}

function PopoverDescription({
  className,
  ...props
}: React.ComponentProps<typeof PopoverDescriptionPrimitive>) {
  return (
    <PopoverDescriptionPrimitive
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  );
}

export {
  Popover,
  PopoverClose,
  PopoverCreateHandle,
  PopoverDescription,
  PopoverPopup,
  PopoverPopup as PopoverContent,
  PopoverTitle,
  PopoverTrigger,
};
export type { PopoverHandle };
