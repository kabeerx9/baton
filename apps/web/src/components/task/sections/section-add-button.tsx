import { Plus } from "lucide-react";
import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

/**
 * The add control at the head of a task section (relations, links, waits on).
 * Outlined, so it reads as an action instead of a caption: the sections it
 * sits in are quiet, and a bare muted icon disappears next to their headings.
 */
export function SectionAddButton({
  className,
  ...props
}: ComponentProps<"button">) {
  return (
    <Button
      type="button"
      variant="outline"
      size="icon-xs"
      className={cn("shrink-0", className)}
      {...props}
    >
      <Plus className="size-3.5" />
    </Button>
  );
}
