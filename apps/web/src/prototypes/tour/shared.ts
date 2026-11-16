import * as React from "react";

export type TourStepId = "board" | "demo-tasks" | "move-task";

export type TourStep = {
  id: TourStepId;
  target: string;
  title: string;
  body: string;
  interactive?: boolean;
};

export const STEPS: TourStep[] = [
  {
    id: "board",
    target: "board",
    title: "This is your board",
    body: "Every task lives in a column. Tasks can wait on each other, and Baton tells people when they can continue.",
  },
  {
    id: "demo-tasks",
    target: "tasks",
    title: "We're adding 5 demo tasks",
    body: "They live in a private demo workspace only you can see. Nothing here touches your real work.",
  },
  {
    id: "move-task",
    target: "api-endpoint",
    title: "Move “Build the API endpoint” to Done",
    body: "Drag the card to Done, or use its status menu. “Write tests” waits on it and gets unblocked.",
    interactive: true,
  },
];

export type VariantProps = {
  stepIndex: number;
  rect: Rect | null;
  /** true once the interactive step's data predicate holds */
  satisfied: boolean;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
};

export type Rect = { top: number; left: number; width: number; height: number };

/** Follows a [data-tour] element. Polls on rAF so layout shifts, scroll and resize all work. */
export function useTargetRect(target: string, enabled = true): Rect | null {
  const [rect, setRect] = React.useState<Rect | null>(null);
  React.useEffect(() => {
    if (!enabled) return;
    let raf = 0;
    let scrolled = false;
    const tick = () => {
      const el = document.querySelector<HTMLElement>(`[data-tour="${target}"]`);
      if (el) {
        if (!scrolled) {
          scrolled = true;
          el.scrollIntoView({ block: "center", behavior: "smooth" });
        }
        const r = el.getBoundingClientRect();
        setRect((prev) =>
          prev &&
          prev.top === r.top &&
          prev.left === r.left &&
          prev.width === r.width &&
          prev.height === r.height
            ? prev
            : { top: r.top, left: r.left, width: r.width, height: r.height },
        );
      } else {
        setRect(null);
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [target, enabled]);
  return rect;
}

/** Where a floating card goes next to a target. Null rect centers it. */
export function placeCard(
  rect: Rect | null,
  card: { w: number; h: number },
  vw: number,
  vh: number,
  gap = 14,
) {
  const w = Math.min(card.w, vw - 32);
  if (!rect)
    return {
      left: (vw - w) / 2,
      top: (vh - card.h) / 2,
      w,
      side: "center" as const,
    };
  const left = Math.min(
    Math.max(rect.left + rect.width / 2 - w / 2, 16),
    vw - w - 16,
  );
  const below = rect.top + rect.height + gap;
  if (below + card.h <= vh - 16)
    return { left, top: below, w, side: "below" as const };
  const above = rect.top - gap - card.h;
  if (above >= 16) return { left, top: above, w, side: "above" as const };
  // Target is huge: sit inside it, bottom-centered.
  return {
    left,
    top: Math.max(
      16,
      Math.min(rect.top + rect.height - card.h - 20, vh - card.h - 16),
    ),
    w,
    side: "inside" as const,
  };
}
