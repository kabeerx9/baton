import { Link } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/cn";
import type { CardPlacement } from "./rect";
import {
  LAST_STEP,
  STEP_IDS,
  STEPS,
  type StepId,
  stepNumber,
} from "./tour-steps";

type StepCardProps = {
  step: StepId;
  placement: CardPlacement;
  /** Shows the skip question instead of the step. */
  confirmingSkip: boolean;
  /** Disables the buttons while a finish call is in flight. */
  busy: boolean;
  onNext: () => void;
  onFinish: () => void;
  onSkipAsk: () => void;
  onSkipCancel: () => void;
  onSkipConfirm: () => void;
};

/** The step card. Takes focus whenever the step or the skip question changes. */
export function StepCard({
  step,
  placement,
  confirmingSkip,
  busy,
  onNext,
  onFinish,
  onSkipAsk,
  onSkipCancel,
  onSkipConfirm,
}: StepCardProps) {
  const { t } = useTranslation("tour");
  const card = useRef<HTMLDivElement>(null);
  const def = STEPS[step];
  const last = step === LAST_STEP;

  useEffect(() => {
    card.current?.focus();
  }, [step, confirmingSkip]);

  return (
    <div
      ref={card}
      role="dialog"
      aria-modal="false"
      aria-label={t("dialogLabel")}
      aria-describedby="tour-step-body"
      tabIndex={-1}
      data-slot="tour-card"
      className={cn(
        "fixed z-[61] rounded-2xl border bg-popover p-4 text-popover-foreground shadow-xl outline-none",
        "animate-in fade-in-0 zoom-in-95 duration-200 motion-reduce:animate-none",
        "max-sm:inset-x-3 max-sm:bottom-3 max-sm:w-auto",
      )}
      style={{
        left: placement.left,
        top: placement.top,
        width: placement.width,
      }}
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
          <div className="flex items-center gap-3">
            <Progress
              value={stepNumber(step)}
              min={0}
              max={STEP_IDS.length}
              aria-label={t("progress", {
                current: stepNumber(step),
                total: STEP_IDS.length,
              })}
              className="flex-1"
            />
            <span className="text-xs tabular-nums text-muted-foreground">
              {t("progress", {
                current: stepNumber(step),
                total: STEP_IDS.length,
              })}
            </span>
          </div>
          <h2 className="mt-3 font-heading text-base font-semibold leading-snug">
            {t(`steps.${step}.title`)}
          </h2>
          <p
            id="tour-step-body"
            className="mt-1.5 text-sm text-muted-foreground"
          >
            {t(`steps.${step}.body`)}
          </p>
          {step === "mcp" && (
            <Link
              to="/dashboard/settings/account/agents"
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-block text-sm font-medium underline underline-offset-4"
            >
              {t("steps.mcp.link")}
            </Link>
          )}
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
              <Button
                size="sm"
                onClick={last ? onFinish : onNext}
                disabled={busy}
              >
                {last ? t("finish") : t("next")}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
