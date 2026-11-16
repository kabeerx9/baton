import { X } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { placeCard, STEPS, type VariantProps } from "./shared";

/** Axis: modal focus. Dimmed page, one anchored card, dots. The board is blocked except the hole. */
export function VariantSpotlight({
  stepIndex,
  rect,
  satisfied,
  onNext,
  onBack,
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
  const pad = 8;
  const hole = rect
    ? {
        top: rect.top - pad,
        left: rect.left - pad,
        width: rect.width + pad * 2,
        height: rect.height + pad * 2,
      }
    : { top: vp.h / 2, left: vp.w / 2, width: 0, height: 0 };
  const mobile = vp.w < 640;
  const pos = mobile ? null : placeCard(rect, { w: 340, h: 210 }, vp.w, vp.h);
  const dim =
    "fixed bg-black/55 transition-[top,left,width,height] duration-300 ease-out motion-reduce:transition-none";
  hole.top = Math.round(hole.top);
  hole.left = Math.round(hole.left);
  hole.width = Math.round(hole.width);
  hole.height = Math.round(hole.height);
  const bottom = hole.top + hole.height;
  const right = hole.left + hole.width;
  return (
    <div className="fixed inset-0 z-50" style={{ pointerEvents: "none" }}>
      {/* four panels = one hole that lets clicks through */}
      <div
        className={dim}
        style={{
          pointerEvents: "auto",
          top: 0,
          left: 0,
          width: vp.w,
          height: Math.max(0, hole.top),
        }}
      />
      <div
        className={dim}
        style={{
          pointerEvents: "auto",
          top: bottom,
          left: 0,
          width: vp.w,
          height: Math.max(0, vp.h - bottom),
        }}
      />
      <div
        className={dim}
        style={{
          pointerEvents: "auto",
          top: hole.top,
          left: 0,
          width: Math.max(0, hole.left),
          height: hole.height,
        }}
      />
      <div
        className={dim}
        style={{
          pointerEvents: "auto",
          top: hole.top,
          left: right,
          width: Math.max(0, vp.w - right),
          height: hole.height,
        }}
      />
      <div
        className="fixed rounded-xl ring-2 ring-primary transition-[top,left,width,height] duration-300 ease-out motion-reduce:transition-none"
        style={{
          top: hole.top,
          left: hole.left,
          width: hole.width,
          height: hole.height,
        }}
      />
      <div
        role="dialog"
        aria-label={step.title}
        key={step.id}
        className={cn(
          "tour-pop fixed rounded-2xl border bg-popover p-4 text-popover-foreground shadow-xl",
          mobile && "inset-x-3 bottom-3",
        )}
        style={{
          pointerEvents: "auto",
          ...(pos ? { left: pos.left, top: pos.top, width: pos.w } : {}),
        }}
      >
        <div className="flex items-center justify-between">
          <div
            className="flex items-center gap-1.5"
            aria-label={`Step ${stepIndex + 1} of ${STEPS.length}`}
          >
            {STEPS.map((s, i) => (
              <span
                key={s.id}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300",
                  i === stepIndex
                    ? "w-5 bg-primary"
                    : i < stepIndex
                      ? "w-1.5 bg-primary/60"
                      : "w-1.5 bg-input",
                )}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={onSkip}
            aria-label="Skip tour"
            className="-m-1 rounded-md p-1 text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
        <h2 className="mt-3 font-heading text-base font-semibold leading-snug">
          {step.title}
        </h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {satisfied
            ? "Done. “Write tests” is unblocked and you just got a notification."
            : step.body}
        </p>
        <div className="mt-4 flex items-center justify-between">
          <button
            type="button"
            onClick={onSkip}
            className="text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            Skip tour
          </button>
          <div className="flex gap-2">
            {stepIndex > 0 && !step.interactive && (
              <Button variant="outline" size="sm" onClick={onBack}>
                Back
              </Button>
            )}
            {step.interactive && !satisfied ? (
              <span
                className="inline-flex h-8 items-center text-xs text-muted-foreground"
                aria-live="polite"
              >
                Waiting for you…
              </span>
            ) : (
              <Button size="sm" onClick={onNext}>
                {last ? "Finish" : "Next"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
