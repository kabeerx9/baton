import { CheckIcon } from "lucide-react";
import { STAGE_LABEL } from "../../copy";
import type { PageProps } from "../../page-props";
import type { Status } from "../../types";

const STEPS: Status[] = ["todo", "doing", "review", "done"];

/** Four steps on the band. Click one to move there; finishing may be refused. */
export function StageStepper({ view, viewer, dispatch }: PageProps) {
  const current = view.status ? STEPS.indexOf(view.status) : -1;
  return (
    <ol className="flex w-full max-w-xl items-center" aria-label="Stage">
      {STEPS.map((s, i) => {
        const past = i < current;
        const here = i === current;
        return (
          <li key={s} className="flex flex-1 items-center last:flex-none">
            <button
              type="button"
              aria-current={here ? "step" : undefined}
              onClick={() => dispatch({ type: "set-status", to: s, viewer })}
              className="group flex items-center gap-2 rounded-full py-1 pr-1 outline-none focus-visible:ring-2 focus-visible:ring-white/70 active:scale-[0.97]"
            >
              <span
                className={`grid size-6 place-items-center rounded-full text-[11px] font-semibold transition-[background-color,transform] duration-200 ease-out ${
                  here
                    ? "scale-110 bg-white text-black shadow-lg"
                    : past
                      ? "bg-white/90 text-black/80"
                      : "bg-white/15 text-white/70 group-hover:bg-white/25"
                }`}
              >
                {past ? (
                  <CheckIcon className="size-3.5" aria-hidden="true" />
                ) : (
                  i + 1
                )}
              </span>
              <span
                className={`hidden text-xs sm:inline ${here ? "font-semibold text-white" : "text-white/70"}`}
              >
                {STAGE_LABEL[s]}
              </span>
            </button>
            {i < STEPS.length - 1 && (
              <span
                className={`mx-2 h-px flex-1 ${i < current ? "bg-white/80" : "bg-white/20"}`}
                aria-hidden="true"
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
