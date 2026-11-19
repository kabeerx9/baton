import { CheckIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { SPLASH_STEPS } from "../copy";
import type { LoadStep } from "../load-view";

/** The real awaited steps of a cold open. Rows are fixed, so nothing moves. */
export function StepList({ step }: { step: LoadStep }) {
  return (
    <ol className="flex w-64 flex-col gap-2.5">
      {SPLASH_STEPS.map((row, index) => {
        const state =
          index < step ? "done" : index === step ? "active" : "waiting";
        return (
          <li
            key={row.pending}
            aria-current={state === "active" ? "step" : undefined}
            className={cn(
              "flex h-5 items-center gap-3 text-sm transition-colors duration-200 ease-out motion-reduce:transition-none",
              state === "waiting" && "text-muted-foreground/60",
              state === "active" && "text-foreground",
              state === "done" && "text-muted-foreground",
            )}
          >
            <span className="grid size-4 shrink-0 place-items-center">
              {state === "done" ? (
                <CheckIcon className="ld-enter size-3.5" />
              ) : state === "active" ? (
                <span className="ld-dot size-1.5 rounded-full bg-foreground" />
              ) : (
                <span className="size-1.5 rounded-full border border-current" />
              )}
            </span>
            <span>{state === "done" ? row.done : row.pending}</span>
          </li>
        );
      })}
    </ol>
  );
}
