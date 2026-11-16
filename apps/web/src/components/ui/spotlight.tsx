import { cn } from "@/lib/cn";

export type Rect = { top: number; left: number; width: number; height: number };

/**
 * One path for the whole dim layer: the viewport with a rounded hole cut out
 * (even-odd fill). One path has no seams, and clicks pass through the hole
 * only because nothing is painted there.
 */
export function maskPath(vw: number, vh: number, hole: Rect | null, r = 12) {
  const outer = `M0 0H${vw}V${vh}H0Z`;
  if (!hole || hole.width <= 0 || hole.height <= 0) return outer;
  const x = hole.left;
  const y = hole.top;
  const w = hole.width;
  const h = hole.height;
  const rr = Math.min(r, w / 2, h / 2);
  const inner =
    `M${x + rr} ${y}H${x + w - rr}A${rr} ${rr} 0 0 1 ${x + w} ${y + rr}` +
    `V${y + h - rr}A${rr} ${rr} 0 0 1 ${x + w - rr} ${y + h}` +
    `H${x + rr}A${rr} ${rr} 0 0 1 ${x} ${y + h - rr}` +
    `V${y + rr}A${rr} ${rr} 0 0 1 ${x + rr} ${y}Z`;
  return `${outer}${inner}`;
}

/**
 * A full-screen dim layer with one hole. Clicks outside the hole hit the
 * layer; clicks inside reach the page, because nothing is painted there.
 */
export function Spotlight({
  viewport,
  hole,
  className,
}: {
  viewport: { width: number; height: number };
  hole: Rect | null;
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      data-slot="spotlight"
      className={cn("pointer-events-none fixed inset-0 size-full", className)}
      width={viewport.width}
      height={viewport.height}
    >
      <path
        d={maskPath(viewport.width, viewport.height, hole)}
        fillRule="evenodd"
        className="pointer-events-auto fill-black/55"
      />
      {hole && (
        <rect
          x={hole.left}
          y={hole.top}
          width={hole.width}
          height={hole.height}
          rx={12}
          className="fill-none stroke-primary stroke-2"
        />
      )}
    </svg>
  );
}
