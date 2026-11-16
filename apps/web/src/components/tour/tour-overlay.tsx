import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { PopoverCreateHandle } from "@/components/ui/popover";
import { Spotlight } from "@/components/ui/spotlight";
import type { DemoTaskKey } from "@/fetchers/tour/types";
import { padRect } from "./rect";
import { StepCard } from "./step-card";
import { STEPS, type StepId, targetSelectors } from "./tour-steps";
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
  onBack: () => void;
  onFinish: () => void;
  onSkipAsk: () => void;
  onSkipCancel: () => void;
  onSkipConfirm: () => void;
};

/**
 * The dim, the hole over the target, and the step card. Between targets on one
 * page the hole and the card glide. Across pages everything fades out, the app
 * navigates, and everything fades back in once the next target has mounted.
 */
export function TourOverlay({ step, taskIds, ...card }: TourOverlayProps) {
  const { t } = useTranslation("tour");
  const reduced = useReducedMotion();
  const viewport = useViewport();
  const def = STEPS[step];
  const target = useTarget(targetSelectors(step, taskIds), def.page);

  // Same rect object in, same object out: the easing effect must not restart
  // on every render.
  const foundRect = target.kind === "found" ? target.rect : null;
  const padded = useMemo(
    () => (foundRect ? padRect(foundRect, 8) : null),
    [foundRect],
  );
  const rect = useEasedRect(padded, reduced);
  const shown = target.kind !== "waiting";
  // The card's anchor reads the eased rect, so it glides with the hole. With
  // no target it is the page center.
  const rectRef = useRef(rect);
  rectRef.current = shown ? rect : rectRef.current;
  const viewportRef = useRef(viewport);
  viewportRef.current = viewport;
  const anchor = useMemo(
    () => ({
      getBoundingClientRect: () => {
        const r = rectRef.current;
        const v = viewportRef.current;
        const box = r ?? {
          left: v.width / 2,
          top: v.height / 2,
          width: 0,
          height: 0,
        };
        return {
          ...box,
          x: box.left,
          y: box.top,
          right: box.left + box.width,
          bottom: box.top + box.height,
          toJSON: () => box,
        } as DOMRect;
      },
    }),
    [],
  );

  // The tour state decides when the card is open and where it points.
  const [handle] = useState(() => PopoverCreateHandle());
  useEffect(() => {
    const controller = handle.controller;
    if (shown) {
      if (!controller.isOpen()) void controller.open({ anchor });
    } else if (controller.isOpen()) {
      controller.close();
    }
  }, [handle, shown, anchor]);

  return (
    <>
      {/* Always mounted, so a screen reader hears each step change. */}
      <p className="sr-only" aria-live="polite" role="status">
        {t(`steps.${step}.title`)}
      </p>
      <Spotlight
        viewport={viewport}
        hole={shown ? rect : null}
        light={def.target === null}
        shown={shown}
        className="z-[60]"
      />
      <StepCard
        step={step}
        handle={handle}
        anchor={anchor}
        centered={def.target === null}
        shown={shown}
        reduced={reduced}
        {...card}
      />
      <style>{`
        @keyframes tour-card-in { from { opacity: 0; transform: scale(0.96) } to { opacity: 1; transform: none } }
        .tour-card-in { animation: tour-card-in 240ms cubic-bezier(0.23, 1, 0.32, 1) both }
      `}</style>
    </>
  );
}
