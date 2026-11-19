"use client";

import {
  Toggle as TogglePrimitive,
  ToggleGroup as ToggleGroupPrimitive,
  type ToggleState,
} from "@ui-sdk/react/toggle";
import { renderElement, type RenderProp } from "@ui-sdk/react/primitive";
import type { VariantProps } from "class-variance-authority";
import * as React from "react";
import { Separator } from "@/components/ui/separator";
import {
  Toggle as ToggleComponent,
  type toggleVariants,
} from "@/components/ui/toggle";
import {
  nextEnabledIndex,
  type ToggleGroupOrientation,
} from "@/components/ui/toggle-group-focus";
import { cn } from "@/lib/cn";

type ToggleGroupContextValue = VariantProps<typeof toggleVariants> & {
  disabled: boolean;
  loop: boolean;
  orientation: ToggleGroupOrientation;
};

const ToggleGroupContext = React.createContext<ToggleGroupContextValue>({
  disabled: false,
  loop: true,
  orientation: "horizontal",
  size: "default",
  variant: "default",
});

type ToggleGroupProps = Omit<
  React.ComponentProps<typeof ToggleGroupPrimitive>,
  "className" | "children"
> &
  VariantProps<typeof toggleVariants> & {
    className?: string;
    children?: React.ReactNode;
  };

function ToggleGroup({
  className,
  variant = "default",
  size = "default",
  orientation = "horizontal",
  loop,
  disabled = false,
  children,
  ...props
}: ToggleGroupProps) {
  const classes = cn(
    "flex w-fit *:focus-visible:z-10 dark:*:[[data-slot=separator]:has(+[data-slot=toggle]:hover)]:before:bg-input/64 dark:*:[[data-slot=separator]:has(+[data-slot=toggle][data-pressed])]:before:bg-input dark:*:[[data-slot=toggle]:hover+[data-slot=separator]]:before:bg-input/64 dark:*:[[data-slot=toggle][data-pressed]+[data-slot=separator]]:before:bg-input",
    orientation === "horizontal"
      ? "*:pointer-coarse:after:min-w-auto"
      : "*:pointer-coarse:after:min-h-auto",
    variant === "default"
      ? "gap-0.5"
      : orientation === "horizontal"
        ? "*:not-first:not-data-[slot=separator]:before:-start-[0.5px] *:not-last:not-data-[slot=separator]:before:-end-[0.5px] *:not-first:rounded-s-none *:not-last:rounded-e-none *:not-first:border-s-0 *:not-last:border-e-0 *:not-first:before:rounded-s-none *:not-last:before:rounded-e-none"
        : "*:not-first:not-data-[slot=separator]:before:-top-[0.5px] *:not-last:not-data-[slot=separator]:before:-bottom-[0.5px] flex-col *:not-first:rounded-t-none *:not-last:rounded-b-none *:not-first:border-t-0 *:not-last:border-b-0 *:not-first:before:rounded-t-none *:not-last:before:rounded-b-none *:data-[slot=toggle]:not-last:before:hidden dark:*:last:before:hidden dark:*:first:before:block",
    className,
  );
  const resolvedLoop = loop ?? true;

  return (
    <ToggleGroupPrimitive
      className={classes}
      data-size={size}
      data-variant={variant}
      disabled={disabled}
      loop={resolvedLoop}
      orientation={orientation}
      {...props}
    >
      <ToggleGroupContext.Provider
        value={{
          disabled,
          loop: resolvedLoop,
          orientation,
          size,
          variant,
        }}
      >
        {children}
      </ToggleGroupContext.Provider>
    </ToggleGroupPrimitive>
  );
}

type ToggleProps = React.ComponentProps<typeof TogglePrimitive> &
  VariantProps<typeof toggleVariants>;

function Toggle({
  className,
  children,
  variant,
  size,
  disabled,
  onKeyDown,
  render,
  ...props
}: ToggleProps) {
  const context = React.useContext(ToggleGroupContext);

  const resolvedVariant = context.variant || variant;
  const resolvedSize = context.size || size;
  const isDisabled = Boolean(disabled || context.disabled);

  // Base UI rendered a grouped disabled toggle as a natively disabled button:
  // out of the tab order, out of the arrow keys, and matched by the
  // `disabled:` styles. UI SDK forces `focusableWhenDisabled` inside a group
  // and reads a `disabled` prop as state only, so force the attribute on the
  // element, keeping whatever render target the caller passed.
  const elementRender: RenderProp<ToggleState> | undefined = isDisabled
    ? (partProps, state) =>
        React.cloneElement(
          renderElement(
            "button",
            partProps,
            render,
            state,
          ) as React.ReactElement<Record<string, unknown>>,
          { disabled: true },
        )
    : render;

  return (
    <ToggleComponent
      className={className}
      data-size={resolvedSize}
      data-variant={resolvedVariant}
      disabled={disabled}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (!event.defaultPrevented) {
          movePastDisabledToggles(event, context);
        }
      }}
      render={elementRender}
      size={resolvedSize}
      variant={resolvedVariant}
      {...props}
    >
      {children}
    </ToggleComponent>
  );
}

/**
 * UI SDK keeps a disabled toggle in its group's arrow-key order on purpose, so
 * the wrapper moves focus itself whenever the group holds a disabled toggle.
 * Native disabled buttons then stay out of the arrow keys, as on Base UI.
 */
function movePastDisabledToggles(
  event: React.KeyboardEvent<HTMLButtonElement>,
  context: ToggleGroupContextValue,
) {
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
    return;
  }

  const el = event.currentTarget;
  const group = el.closest('[data-slot="toggle-group"]');
  if (!group || !group.querySelector('[data-slot="toggle"]:disabled')) {
    // Nothing is disabled: UI SDK's own roving focus is the right movement.
    return;
  }

  const items = Array.from(
    group.querySelectorAll<HTMLButtonElement>('[data-slot="toggle"]'),
  ).filter((item) => !item.matches(":disabled"));
  const index = items.indexOf(el);
  const next = nextEnabledIndex({
    count: items.length,
    index,
    key: event.key,
    loop: context.loop,
    orientation: context.orientation,
    rtl: getComputedStyle(el).direction === "rtl",
  });
  if (next === null) {
    return;
  }

  event.preventDefault();
  if (next !== index) {
    items[next]?.focus();
  }
}

function ToggleGroupSeparator({
  className,
  orientation = "vertical",
  ...props
}: {
  className?: string;
} & React.ComponentProps<typeof Separator>) {
  return (
    <Separator
      className={cn(
        "pointer-events-none relative bg-input before:absolute before:inset-0 dark:before:bg-input/32",
        className,
      )}
      orientation={orientation}
      {...props}
    />
  );
}

export { Toggle, Toggle as ToggleGroupItem, ToggleGroup, ToggleGroupSeparator };
