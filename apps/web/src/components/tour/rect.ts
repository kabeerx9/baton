import type { Rect } from "@/components/ui/spotlight";

export type { Rect };

export function sameRect(a: Rect | null, b: Rect | null) {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.top === b.top &&
    a.left === b.left &&
    a.width === b.width &&
    a.height === b.height
  );
}

/** Moves `from` a fraction of the way to `to`. Snaps when close enough. */
export function easeRect(from: Rect, to: Rect, k = 0.28): Rect {
  const step = (a: number, b: number) =>
    Math.abs(b - a) < 0.5 ? b : a + (b - a) * k;
  return {
    top: step(from.top, to.top),
    left: step(from.left, to.left),
    width: step(from.width, to.width),
    height: step(from.height, to.height),
  };
}

export function padRect(rect: Rect, pad: number): Rect {
  return {
    top: rect.top - pad,
    left: rect.left - pad,
    width: rect.width + pad * 2,
    height: rect.height + pad * 2,
  };
}

export type CardPlacement = {
  left: number;
  top: number;
  width: number;
};

/** Where the step card sits next to a target. A missing target centers it. */
export function placeCard(
  rect: Rect | null,
  card: { width: number; height: number },
  viewport: { width: number; height: number },
  gap = 14,
): CardPlacement {
  const width = Math.min(card.width, viewport.width - 32);
  if (!rect) {
    return {
      left: (viewport.width - width) / 2,
      top: Math.max(16, (viewport.height - card.height) / 2),
      width,
    };
  }
  const left = Math.min(
    Math.max(rect.left + rect.width / 2 - width / 2, 16),
    viewport.width - width - 16,
  );
  const below = rect.top + rect.height + gap;
  if (below + card.height <= viewport.height - 16) {
    return { left, top: below, width };
  }
  const above = rect.top - gap - card.height;
  if (above >= 16) return { left, top: above, width };
  // A target that fills the screen: the card sits inside it, near the bottom.
  return {
    left,
    top: Math.max(16, viewport.height - card.height - 24),
    width,
  };
}
