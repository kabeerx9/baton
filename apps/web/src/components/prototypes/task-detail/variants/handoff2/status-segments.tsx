import { motion } from "motion/react";
import { useRef } from "react";
import { StatusIcon } from "@/components/board/status-icon";
import { Kbd } from "@/components/ui/kbd";
import { STAGE_LABEL } from "../../copy";
import type { PageProps } from "../../page-props";
import type { Status } from "../../types";
import { consentLine } from "./consent";
import { STATUS_KEY } from "./status-keys";

const STEPS: Status[] = ["todo", "doing", "review", "done"];

/**
 * One segmented control across the page. The current step is filled. Arrow
 * keys move between steps; they stop here so the picker does not switch.
 */
export function StatusSegments({ task, view, viewer, dispatch }: PageProps) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const current = view.status ? STEPS.indexOf(view.status) : -1;
  const note = consentLine(task, viewer);
  const choose = (s: Status) => dispatch({ type: "set-status", to: s, viewer });
  return (
    <div
      role="presentation"
      onKeyDown={(e) => {
        if (!e.key.startsWith("Arrow")) return;
        e.stopPropagation();
        const dir = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : -1;
        const next = (Math.max(current, 0) + dir + STEPS.length) % STEPS.length;
        refs.current[next]?.focus();
        choose(STEPS[next]!);
      }}
    >
      <div
        role="radiogroup"
        aria-label="Status"
        className="flex w-full gap-1 rounded-2xl border border-border bg-muted/50 p-1"
      >
        {STEPS.map((s, i) => {
          const on = i === current;
          return (
            <button
              key={s}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="radio"
              aria-checked={on}
              tabIndex={on || (current < 0 && i === 0) ? 0 : -1}
              onClick={() => choose(s)}
              className={`relative flex h-11 flex-1 items-center justify-center gap-2 rounded-xl text-sm font-medium outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98] ${on ? "text-background" : "text-muted-foreground hover:text-foreground"}`}
            >
              {on && (
                <motion.span
                  layoutId="status-fill"
                  className="absolute inset-0 rounded-xl bg-foreground"
                  transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}
                />
              )}
              <span className="relative flex items-center gap-2">
                <span className={on ? "[&_svg]:text-background" : ""}>
                  <StatusIcon status={s} size={14} />
                </span>
                <span className="hidden sm:inline">{STAGE_LABEL[s]}</span>
                <span className="sm:hidden">
                  {STAGE_LABEL[s].split(" ").pop()}
                </span>
                <Kbd
                  size="sm"
                  tone="muted"
                  className="hidden lg:inline-flex"
                  aria-hidden="true"
                >
                  {STATUS_KEY[s].toUpperCase()}
                </Kbd>
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {note ??
          "Pick a step to move the task. Finishing waits for open blockers."}
      </p>
    </div>
  );
}
