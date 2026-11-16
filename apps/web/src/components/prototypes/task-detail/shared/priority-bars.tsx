import { PRIORITY_BARS, PRIORITY_COLOR } from "../tone";
import type { Priority } from "../types";

/** Four small bars, filled up to the level. Color rises with urgency. */
export function PriorityBars({ priority }: { priority: Priority }) {
  const filled = PRIORITY_BARS[priority];
  return (
    <span className="inline-flex items-end gap-px" aria-hidden="true">
      {[1, 2, 3, 4].map((n) => (
        <span
          key={n}
          className={`w-[3px] rounded-[1px] ${n <= filled ? PRIORITY_COLOR[priority] : "bg-muted-foreground/20"}`}
          style={{ height: 3 + n * 2 }}
        />
      ))}
    </span>
  );
}
