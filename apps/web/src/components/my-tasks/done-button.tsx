import { LockIcon } from "lucide-react";
import { useState } from "react";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/cn";

const RING =
  "relative inline-flex size-[18px] shrink-0 items-center justify-center rounded-full border-[1.5px]";

/**
 * The round control that finishes a task. It fills at once, so the row can
 * leave with the tick showing. A task that cannot be finished shows a lock and
 * the reason instead, and is not a button.
 */
export function DoneButton({
  label,
  blocked,
  onDone,
  className,
}: {
  label: string;
  /** Why the task cannot be finished: a short name for it, and the detail. */
  blocked?: { label: string; detail: string } | null;
  onDone: () => void;
  className?: string;
}) {
  const [checked, setChecked] = useState(false);
  if (blocked) {
    return (
      <Tooltip>
        <TooltipTrigger
          render={
            <span
              aria-label={blocked.label}
              className={cn(
                RING,
                "border-foreground/20 border-dashed text-muted-foreground",
                className,
              )}
              role="img"
            />
          }
        >
          <LockIcon aria-hidden="true" className="size-2.5" />
        </TooltipTrigger>
        <TooltipPopup className="whitespace-pre-line">
          {blocked.detail}
        </TooltipPopup>
      </Tooltip>
    );
  }
  return (
    <button
      aria-label={label}
      className={cn(
        RING,
        "group/done cursor-pointer border-foreground/25 text-foreground/45 outline-none transition-[background-color,border-color,color,scale] duration-150 ease-out hover:border-foreground/55 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-90 data-checked:border-primary data-checked:bg-primary data-checked:text-primary-foreground pointer-coarse:after:absolute pointer-coarse:after:size-11",
        className,
      )}
      data-checked={checked ? "" : undefined}
      onClick={() => {
        setChecked(true);
        onDone();
      }}
      type="button"
    >
      {/* The tick previews on hover and draws on press. */}
      <svg
        aria-hidden="true"
        className="size-2.5 transition-[stroke-dashoffset] duration-150 ease-(--ease-out) [stroke-dasharray:12] [stroke-dashoffset:12] group-data-checked/done:[stroke-dashoffset:0] motion-reduce:transition-none [@media(hover:hover)_and_(pointer:fine)]:group-hover/done:[stroke-dashoffset:0]"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.2"
        viewBox="0 0 12 12"
      >
        <path d="M2.5 6.5 5 9l4.5-6" />
      </svg>
    </button>
  );
}
