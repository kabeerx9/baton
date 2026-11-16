import * as React from "react";
import { cn } from "@/lib/cn";
import { placeCard, STEPS, type VariantProps } from "./shared";

/** Axis: non-blocking hint. No dim. A pulsing beacon on the target and a small bubble, so the user keeps working. */
export function VariantBeacon({
  stepIndex,
  rect,
  satisfied,
  onNext,
  onSkip,
}: VariantProps) {
  const step = STEPS[stepIndex];
  const last = stepIndex === STEPS.length - 1;
  const [vp, setVp] = React.useState({
    w: window.innerWidth,
    h: window.innerHeight,
  });
  React.useEffect(() => {
    const f = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", f);
    return () => window.removeEventListener("resize", f);
  }, []);
  const pos = placeCard(rect, { w: 288, h: 150 }, vp.w, vp.h, 12);
  const pct = ((stepIndex + (satisfied ? 1 : 0.5)) / STEPS.length) * 100;
  return (
    <div className="pointer-events-none fixed inset-0 z-50">
      {rect && (
        <div
          className="tour-pulse fixed rounded-xl border-2 border-primary transition-[top,left,width,height] duration-300 ease-out motion-reduce:transition-none"
          style={{
            top: rect.top - 4,
            left: rect.left - 4,
            width: rect.width + 8,
            height: rect.height + 8,
          }}
        >
          <span className="absolute -top-3 -left-3 flex size-6 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground shadow-md">
            {stepIndex + 1}
          </span>
        </div>
      )}
      <div
        key={step.id}
        role="status"
        aria-live="polite"
        className={cn(
          "tour-pop pointer-events-auto fixed overflow-hidden rounded-xl border bg-foreground text-background shadow-xl",
          "max-sm:inset-x-3 max-sm:!top-auto max-sm:bottom-3 max-sm:!w-auto",
        )}
        style={{ left: pos.left, top: pos.top, width: pos.w }}
      >
        <div className="p-3.5">
          <p className="text-[13px] font-semibold leading-snug">{step.title}</p>
          <p className="mt-1 text-xs leading-relaxed opacity-70">
            {satisfied
              ? "Nice. “Write tests” is unblocked, and a notification is on its way."
              : step.body}
          </p>
          <div className="mt-3 flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={onSkip}
              className="opacity-60 hover:opacity-100"
            >
              Skip
            </button>
            {step.interactive && !satisfied ? (
              <span className="opacity-60">Try it on the card</span>
            ) : (
              <button
                type="button"
                onClick={onNext}
                className="rounded-md bg-background px-2.5 py-1 font-medium text-foreground"
              >
                {last ? "Finish" : "Got it"}
              </button>
            )}
          </div>
        </div>
        <div className="h-0.5 bg-background/15" aria-hidden>
          <div
            className="h-full bg-background transition-[width] duration-300 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}
