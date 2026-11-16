import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  type PopoverHandle,
} from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/cn";
import {
  LAST_STEP,
  STEP_IDS,
  STEPS,
  type StepId,
  stepNumber,
} from "./tour-steps";

type StepCardProps = {
  step: StepId;
  /** Opens, closes and anchors the card. Tour state drives it; the card holds none. */
  handle: PopoverHandle;
  /**
   * Where the card points: the (eased) spotlight rect, or `null` to center.
   * Read on every position check, so the card glides with the hole.
   */
  anchor: { getBoundingClientRect: () => DOMRect };
  centered: boolean;
  /** False while the card is fading out for a route change. */
  shown: boolean;
  reduced: boolean;
  /** Shows the skip question instead of the step. */
  confirmingSkip: boolean;
  /** Disables the buttons while a finish call is in flight. */
  busy: boolean;
  onNext: () => void;
  onBack: () => void;
  onFinish: () => void;
  onSkipAsk: () => void;
  onSkipCancel: () => void;
  onSkipConfirm: () => void;
};

const CENTER_HALF_HEIGHT = 125;

/**
 * The step card. It glides between targets with a transform, fades with the
 * dim on a route change, and takes focus when the step or question changes.
 */
export function StepCard({
  step,
  handle,
  anchor,
  centered,
  shown,
  reduced,
  confirmingSkip,
  busy,
  onNext,
  onBack,
  onFinish,
  onSkipAsk,
  onSkipCancel,
  onSkipConfirm,
}: StepCardProps) {
  const { t } = useTranslation("tour");
  const card = useRef<HTMLDivElement>(null);
  const def = STEPS[step];
  const last = step === LAST_STEP;
  const first = step === STEP_IDS[0];

  useEffect(() => {
    if (shown) card.current?.focus({ preventScroll: true });
  }, [step, confirmingSkip, shown]);

  return (
    <Popover handle={handle} modal={false} dismissible={false}>
      <PopoverContent
        anchor={anchor}
        side="bottom"
        align="center"
        // A centered card sits half its height above the center point.
        sideOffset={centered ? -CENTER_HALF_HEIGHT : 14}
        collisionPadding={12}
        initialFocus="[data-autofocus]"
        finalFocus="none"
        data-slot="tour-card"
        aria-label={t("dialogLabel")}
        className={cn(
          "z-[61] w-[340px] max-w-[calc(100vw-24px)] rounded-2xl p-4 text-popover-foreground shadow-xl",
          "duration-200 data-starting-style:scale-95 data-ending-style:scale-95",
          reduced && "!scale-100 !translate-x-0 !translate-y-0",
        )}
      >
        <div
          ref={card}
          tabIndex={-1}
          className="outline-none"
          aria-describedby="tour-step-body"
        >
          {/* Remounts per step: the content eases in as the card arrives. */}
          <div
            key={`${step}-${confirmingSkip}`}
            className={cn(!reduced && "tour-card-in")}
          >
            {confirmingSkip ? (
              <div>
                <h2 className="font-heading text-base font-semibold">
                  {t("skipConfirm.title")}
                </h2>
                <p
                  id="tour-step-body"
                  className="mt-1.5 text-sm text-muted-foreground"
                >
                  {t("skipConfirm.body")}
                </p>
                <div className="mt-4 flex justify-end gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onSkipCancel}
                    disabled={busy}
                  >
                    {t("skipConfirm.cancel")}
                  </Button>
                  <Button size="sm" onClick={onSkipConfirm} disabled={busy}>
                    {t("skipConfirm.confirm")}
                  </Button>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="font-medium uppercase tracking-wide text-muted-foreground">
                    {t(`sections.${def.section}`)}
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {t("progress", {
                      current: stepNumber(step),
                      total: STEP_IDS.length,
                    })}
                  </span>
                </div>
                <Progress
                  value={stepNumber(step)}
                  min={0}
                  max={STEP_IDS.length}
                  aria-label={t("progress", {
                    current: stepNumber(step),
                    total: STEP_IDS.length,
                  })}
                  className="mt-2"
                />
                <h2 className="mt-3 font-heading text-base font-semibold leading-snug">
                  {t(`steps.${step}.title`)}
                </h2>
                <p
                  id="tour-step-body"
                  className="mt-1.5 text-sm text-muted-foreground"
                >
                  {t(`steps.${step}.body`)}
                </p>
                <div className="mt-4 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={onSkipAsk}
                    disabled={busy}
                    className="rounded-md text-sm text-muted-foreground underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {t("skip")}
                  </button>
                  {def.waitsForData ? (
                    <span className="text-xs text-muted-foreground">
                      {t("waitingForYou")}
                    </span>
                  ) : (
                    <div className="flex gap-2">
                      {!first && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={onBack}
                          disabled={busy}
                        >
                          {t("back")}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        data-autofocus=""
                        onClick={last ? onFinish : onNext}
                        disabled={busy}
                      >
                        {last ? t("finish") : t("next")}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
