import { ChevronDownIcon } from "lucide-react";
import { motion } from "motion/react";
import { forwardRef } from "react";
import { StatusIcon } from "@/components/board/status-icon";
import { Kbd } from "@/components/ui/kbd";
import { STAGE_LABEL } from "../../copy";
import type { TaskView } from "../../derive";
import { toneOf } from "../../tone";
import { CALM } from "./calm-tone";
import { OPEN_MENU_KEY } from "./status-keys";

const R = 58;
const C = 2 * Math.PI * R;
const PROGRESS = { todo: 0.05, doing: 0.5, review: 0.8, done: 1 } as const;

/**
 * The circle: the status, as an icon and a word. When `interactive`, it is the
 * button that opens the status menu (props come from the menu trigger).
 */
export const CalmCore = forwardRef<
  HTMLButtonElement | HTMLDivElement,
  {
    view: TaskView;
    interactive: boolean;
    request: boolean;
  } & React.HTMLAttributes<HTMLElement>
>(function CalmCore({ view, interactive, request, ...rest }, ref) {
  const tone = CALM[toneOf(view.state)];
  const status = view.status;
  const progress = status ? PROGRESS[status] : 0;
  const body = (
    <>
      <svg
        viewBox="0 0 140 140"
        className={`absolute inset-0 -rotate-90 ${tone.ring}`}
        aria-hidden="true"
      >
        <circle
          cx="70"
          cy="70"
          r={R}
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.14}
          strokeWidth={5}
        />
        <motion.circle
          cx="70"
          cy="70"
          r={R}
          fill="none"
          stroke="currentColor"
          strokeWidth={5}
          strokeLinecap="round"
          strokeDasharray={C}
          initial={{ strokeDashoffset: C }}
          animate={{ strokeDashoffset: C * (1 - progress) }}
          transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
        />
      </svg>
      <span className="relative flex flex-col items-center gap-1">
        {status && <StatusIcon status={status} size={30} />}
        <span className="text-lg leading-tight font-semibold">
          {status ? STAGE_LABEL[status] : "Unknown"}
        </span>
        {interactive && (
          <span className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
            {request ? "Request change" : "Change"}
            <ChevronDownIcon className="size-3" aria-hidden="true" />
            <Kbd size="sm" tone="muted" aria-hidden="true">
              {OPEN_MENU_KEY.toUpperCase()}
            </Kbd>
          </span>
        )}
      </span>
    </>
  );
  const cls =
    "relative grid size-[176px] shrink-0 place-items-center rounded-full border bg-card " +
    tone.border;
  if (!interactive) {
    return (
      <div
        ref={ref as React.Ref<HTMLDivElement>}
        className={cls}
        aria-label={`Status: ${status ? STAGE_LABEL[status] : "Unknown"}`}
        role="img"
      >
        {body}
      </div>
    );
  }
  return (
    <button
      ref={ref as React.Ref<HTMLButtonElement>}
      type="button"
      aria-label={`Status: ${status ? STAGE_LABEL[status] : "Unknown"}. Change status`}
      className={`${cls} cursor-pointer outline-none transition-[box-shadow,scale] duration-150 ease-out hover:shadow-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.98]`}
      {...(rest as React.ButtonHTMLAttributes<HTMLButtonElement>)}
    >
      {body}
    </button>
  );
});
