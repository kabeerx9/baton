"use client";

import {
  ToastAction,
  ToastDescription,
  ToastRegion,
  ToastTitle,
} from "@ui-sdk/react/toast";
import {
  CircleAlertIcon,
  CircleCheckIcon,
  InfoIcon,
  LoaderCircleIcon,
  TriangleAlertIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { buttonVariants } from "@/components/ui/button";
import { toaster, toastManager } from "@/components/ui/toast-manager";
import { ToastShakeRoot } from "@/components/ui/toast-shake-root";
import { cn } from "@/lib/cn";
import type { ToastIcon } from "@/lib/toast";

const TOAST_ICONS = {
  error: CircleAlertIcon,
  info: InfoIcon,
  loading: LoaderCircleIcon,
  success: CircleCheckIcon,
  warning: TriangleAlertIcon,
} as const;

type ToastPosition =
  | "top-left"
  | "top-center"
  | "top-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

interface ToastProviderProps {
  children?: ReactNode;
  position?: ToastPosition;
}

function ToastProvider({
  children,
  position = "bottom-right",
}: ToastProviderProps) {
  return (
    <>
      {children}
      <Toasts position={position} />
    </>
  );
}

function Toasts({ position }: { position: ToastPosition }) {
  const side = position.startsWith("top") ? "top" : "bottom";
  const align = position.includes("center")
    ? "center"
    : position.includes("left")
      ? "start"
      : "end";

  return (
    <ToastRegion
      align={align}
      className={cn(
        // The region is a popover in the top layer: reset the browser's popover box.
        "fixed inset-auto m-0 overflow-visible border-0 bg-transparent p-0 outline-none [--toast-gap:--spacing(3)] [--toast-inset:--spacing(4)] sm:[--toast-inset:--spacing(8)]",
        "h-(--toast-front-height,0px) w-[calc(100%-var(--toast-inset)*2)] max-w-90",
        "data-expanded:h-[calc(var(--toast-stack-height)+(var(--toast-count)-1)*var(--toast-gap))]",
        "data-[side=top]:top-(--toast-inset) data-[side=bottom]:bottom-(--toast-inset)",
        "data-[align=start]:left-(--toast-inset) data-[align=end]:right-(--toast-inset)",
        "data-[align=center]:left-1/2 data-[align=center]:-translate-x-1/2",
      )}
      data-position={position}
      side={side}
      toaster={toaster}
    >
      {(toast) => {
        const data = toast.data as
          | { icon?: ToastIcon; repeat?: number }
          | undefined;
        const Icon =
          data?.icon ?? TOAST_ICONS[toast.type as keyof typeof TOAST_ICONS];

        return (
          <ToastShakeRoot
            shakeKey={data?.repeat}
            className={cn(
              "group/toast absolute z-[calc(100-var(--toast-index))] w-full select-none rounded-lg border bg-popover not-dark:bg-clip-padding text-popover-foreground shadow-lg/5 [transition:transform_.3s_var(--ease-out),opacity_.3s_var(--ease-out),height_.15s_var(--ease-out)] before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-lg)-1px)] before:shadow-[0_1px_--theme(--color-black/4%)] dark:before:shadow-[0_-1px_--theme(--color-white/6%)]",
              // Position
              "data-[position*=right]:right-0 data-[position*=right]:left-auto",
              "data-[position*=left]:right-auto data-[position*=left]:left-0",
              "data-[position*=center]:right-0 data-[position*=center]:left-0",
              "data-[position*=top]:top-0 data-[position*=top]:bottom-auto data-[position*=top]:origin-top",
              "data-[position*=bottom]:top-auto data-[position*=bottom]:bottom-0 data-[position*=bottom]:origin-bottom",
              // Gap fill, so the pointer does not leave the stack between toasts
              "after:absolute after:left-0 after:h-[calc(var(--toast-gap)+1px)] after:w-full",
              "data-[position*=top]:after:top-full",
              "data-[position*=bottom]:after:bottom-full",
              // Variables. A collapsed toast is as tall as the newest one.
              "h-(--toast-calc-height) [--toast-calc-height:var(--toast-front-height,var(--toast-height))] [--toast-peek:--spacing(3)] [--toast-scale:calc(max(0,1-(var(--toast-index)*.1)))] [--toast-shrink:calc(1-var(--toast-scale))]",
              "data-[position]:data-expanded:[--toast-calc-height:var(--toast-height)]",
              "data-[position*=top]:[--toast-calc-offset-y:calc(var(--toast-offset)+var(--toast-index)*var(--toast-gap)+var(--toast-swipe-y,0px))]",
              "data-[position*=bottom]:[--toast-calc-offset-y:calc(var(--toast-offset)*-1+var(--toast-index)*var(--toast-gap)*-1+var(--toast-swipe-y,0px))]",
              // Collapsed: toasts behind peek out above or below the newest
              "data-[position*=top]:transform-[translateX(var(--toast-swipe-x,0px))_translateY(calc(var(--toast-swipe-y,0px)+(var(--toast-index)*var(--toast-peek))+(var(--toast-shrink)*var(--toast-calc-height))))_scale(var(--toast-scale))]",
              "data-[position*=bottom]:transform-[translateX(var(--toast-swipe-x,0px))_translateY(calc(var(--toast-swipe-y,0px)-(var(--toast-index)*var(--toast-peek))-(var(--toast-shrink)*var(--toast-calc-height))))_scale(var(--toast-scale))]",
              // Expanded: toasts spread out
              "data-[position]:data-expanded:transform-[translateX(var(--toast-swipe-x,0px))_translateY(var(--toast-calc-offset-y))]",
              // Swiping follows the pointer with no easing
              "data-swiping:transition-none",
              // Enter
              "data-starting-style:transition-none",
              "data-[position*=top]:data-starting-style:data-front:transform-[translateY(calc(-100%-var(--toast-inset)))]",
              "data-[position*=bottom]:data-starting-style:data-front:transform-[translateY(calc(100%+var(--toast-inset)))]",
              "data-starting-style:not-data-front:opacity-0",
              // Exit
              "data-ending-style:opacity-0",
              "data-ending-style:not-data-swipe-direction:transform-[translateY(calc(100%+var(--toast-inset)))]",
              "data-ending-style:data-[swipe-direction=left]:transform-[translateX(calc(var(--toast-swipe-x,0px)-100%-var(--toast-inset)))_translateY(var(--toast-calc-offset-y))]",
              "data-ending-style:data-[swipe-direction=right]:transform-[translateX(calc(var(--toast-swipe-x,0px)+100%+var(--toast-inset)))_translateY(var(--toast-calc-offset-y))]",
              "data-ending-style:data-[swipe-direction=up]:transform-[translateY(calc(var(--toast-swipe-y,0px)-100%-var(--toast-inset)))]",
              "data-ending-style:data-[swipe-direction=down]:transform-[translateY(calc(var(--toast-swipe-y,0px)+100%+var(--toast-inset)))]",
            )}
            data-position={position}
          >
            <div className="pointer-events-auto flex items-center justify-between gap-1.5 overflow-hidden px-3.5 py-3 text-sm transition-opacity duration-250 group-[:not([data-front],[data-expanded])]/toast:pointer-events-none group-[:not([data-front],[data-expanded])]/toast:opacity-0">
              <div className="flex gap-2">
                {Icon && (
                  <div
                    className="[&>svg]:h-lh [&>svg]:w-4 [&_svg]:pointer-events-none [&_svg]:shrink-0"
                    data-slot="toast-icon"
                  >
                    <Icon
                      className={cn(
                        data?.icon
                          ? "text-muted-foreground"
                          : "in-data-[type=loading]:animate-spin in-data-[type=error]:text-destructive in-data-[type=info]:text-info in-data-[type=success]:text-success in-data-[type=warning]:text-warning in-data-[type=loading]:opacity-80",
                      )}
                    />
                  </div>
                )}

                <div className="flex flex-col gap-0.5">
                  <ToastTitle className="font-sans font-normal tracking-normal" />
                  <ToastDescription className="text-muted-foreground" />
                </div>
              </div>
              {toast.action && (
                <ToastAction className={buttonVariants({ size: "xs" })} />
              )}
            </div>
          </ToastShakeRoot>
        );
      }}
    </ToastRegion>
  );
}

export { type ToastPosition, ToastProvider, toastManager };
