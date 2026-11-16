import { Check } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { STEPS, type VariantProps } from "./shared";

/** Axis: checklist. A docked guide shows the whole path and progress; the target gets an outline, no dimming. */
export function VariantGuide({
  stepIndex,
  rect,
  satisfied,
  onNext,
  onSkip,
}: VariantProps) {
  const step = STEPS[stepIndex];
  const last = stepIndex === STEPS.length - 1;
  const done = stepIndex + (satisfied ? 1 : 0);
  return (
    <div className="pointer-events-none fixed inset-0 z-50">
      {rect && (
        <div
          className="fixed rounded-xl outline-2 outline-offset-2 outline-primary transition-[top,left,width,height] duration-300 ease-out motion-reduce:transition-none"
          style={{
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
            outlineStyle: "dashed",
          }}
        />
      )}
      <aside
        aria-label="Product tour"
        className="tour-pop pointer-events-auto fixed right-4 bottom-4 w-[344px] rounded-2xl border bg-popover p-4 text-popover-foreground shadow-xl max-sm:inset-x-3 max-sm:bottom-3 max-sm:w-auto"
      >
        <div className="flex items-baseline justify-between">
          <h2 className="font-heading text-sm font-semibold">Quick tour</h2>
          <span className="text-xs tabular-nums text-muted-foreground">
            {done} of {STEPS.length}
          </span>
        </div>
        <Progress
          value={(done / STEPS.length) * 100}
          aria-label="Tour progress"
          className="mt-2"
        />
        <ol className="mt-3 flex flex-col gap-1">
          {STEPS.map((s, i) => {
            const complete = i < stepIndex || (i === stepIndex && satisfied);
            const current = i === stepIndex;
            return (
              <li
                key={s.id}
                aria-current={current ? "step" : undefined}
                className={cn(
                  "rounded-lg px-2 py-1.5 text-sm",
                  current && "bg-accent",
                )}
              >
                <div className="flex items-start gap-2">
                  <span
                    className={cn(
                      "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border text-[10px]",
                      complete
                        ? "border-primary bg-primary text-primary-foreground"
                        : current
                          ? "border-primary"
                          : "border-input",
                    )}
                  >
                    {complete ? <Check className="size-2.5" /> : i + 1}
                  </span>
                  <div className="min-w-0">
                    <p
                      className={cn(
                        "font-medium",
                        !current && !complete && "text-muted-foreground",
                      )}
                    >
                      {s.title}
                    </p>
                    {current && (
                      <p
                        aria-live="polite"
                        className="mt-1 text-xs text-muted-foreground"
                      >
                        {satisfied
                          ? "Done. “Write tests” is unblocked and you got a notification."
                          : s.body}
                      </p>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
        <div className="mt-3 flex items-center justify-between">
          <button
            type="button"
            onClick={onSkip}
            className="text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            Skip tour
          </button>
          {step.interactive && !satisfied ? (
            <span className="text-xs text-muted-foreground">
              Waiting for you…
            </span>
          ) : (
            <Button size="sm" onClick={onNext}>
              {last ? "Finish" : "Next"}
            </Button>
          )}
        </div>
      </aside>
    </div>
  );
}
