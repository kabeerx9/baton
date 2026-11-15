import type { AssignedTask } from "@/fetchers/task/get-assigned-tasks";
import { cn } from "@/lib/cn";
import { resolveLabelColor } from "@/lib/label-color";

/** The first few labels: a colour dot and the name. */
export function LabelDots({
  labels,
  max = 2,
  className,
}: {
  labels: AssignedTask["labels"];
  max?: number;
  className?: string;
}) {
  if (labels.length === 0) return null;
  return (
    <span className={cn("flex min-w-0 items-center gap-2", className)}>
      {labels.slice(0, max).map((label) => (
        <span
          className="flex min-w-0 items-center gap-1.5 text-muted-foreground text-xs"
          key={label.id}
        >
          <span
            aria-hidden="true"
            className="size-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: resolveLabelColor(label.color) }}
          />
          <span className="truncate">{label.name}</span>
        </span>
      ))}
    </span>
  );
}
