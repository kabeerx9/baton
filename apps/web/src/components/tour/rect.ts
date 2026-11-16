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
