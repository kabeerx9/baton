import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Spotlight } from "@/components/ui/spotlight";
import type { DemoTaskKey } from "@/fetchers/tour/types";
import { padRect, placeCard } from "./rect";
import { StepCard } from "./step-card";
import { targetSelector, type StepId } from "./tour-steps";
import { useEasedRect } from "./use-eased-rect";
import { useReducedMotion } from "./use-reduced-motion";
import { useTarget } from "./use-target";
import { useViewport } from "./use-viewport";

type TourOverlayProps = {
  step: StepId;
  taskIds: Record<DemoTaskKey, string>;
  confirmingSkip: boolean;
  busy: boolean;
  onNext: () => void;
  onFinish: () => void;
  onSkipAsk: () => void;
  onSkipCancel: () => void;
  onSkipConfirm: () => void;
};

const CARD = { width: 340, height: 230 };

/** The dimmed page, the hole over the target, and the step card. */
export function TourOverlay({ step, taskIds, ...card }: TourOverlayProps) {
  const { t } = useTranslation("tour");
  const reduced = useReducedMotion();
  const viewport = useViewport();
  const target = useTarget(targetSelector(step, taskIds));
  // Same rect object in, same object out: the easing effect must not restart
  // on every render.
  const foundRect = target.kind === "found" ? target.rect : null;
  const padded = useMemo(
    () => (foundRect ? padRect(foundRect, 8) : null),
    [foundRect],
  );
  const rect = useEasedRect(padded, reduced);

  // Show nothing for a step until its target is known: no flash of a
  // centered card before it jumps to the target.
  const placement = placeCard(padded, CARD, viewport);
  return (
    <>
      {/* Always mounted, so a screen reader hears each step change. */}
      <p className="sr-only" aria-live="polite" role="status">
        {t(`steps.${step}.title`)}
      </p>
      {target.kind !== "waiting" && (
        <>
          <Spotlight viewport={viewport} hole={rect} className="z-[60]" />
          <StepCard step={step} placement={placement} {...card} />
        </>
      )}
    </>
  );
}
