import { Separator as SeparatorPrimitive } from "@ui-sdk/react/separator";
import type { ComponentProps } from "react";

import { cn } from "@/lib/cn";

function Separator({
  className,
  orientation = "horizontal",
  ...props
}: ComponentProps<typeof SeparatorPrimitive>) {
  return (
    <SeparatorPrimitive
      className={cn(
        "shrink-0 bg-border data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full data-[orientation=vertical]:w-px data-[orientation=vertical]:not-[[class^='h-']]:not-[[class*='_h-']]:self-stretch",
        className,
      )}
      orientation={orientation}
      {...props}
    />
  );
}

export { Separator };
