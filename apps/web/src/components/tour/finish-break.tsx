import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef } from "react";
import { clipPath, makeShards } from "./shard-geometry";
import { useReducedMotion } from "./use-reduced-motion";

/** The screen is covered from here, so the app can change underneath. */
export const COVER_AT_MS = 380;
const FALL_MS = 950;
const MAX_DELAY_MS = 450; // matches the largest `delay` in makeShards
/** Everything has fallen by here. */
export const BREAK_TOTAL_MS = COVER_AT_MS + MAX_DELAY_MS + FALL_MS + 120;
const FADE_TOTAL_MS = 800;
const FADE_COVER_MS = 200;

// Inline so the animation ships with the lazy tour chunk, not the main CSS.
const KEYFRAMES = `
@keyframes tour-appear { from { opacity: 0 } to { opacity: 1 } }
@keyframes tour-vanish { from { opacity: 1 } to { opacity: 0 } }
@keyframes tour-fall {
  from { transform: none }
  to { transform: translate(var(--dx), var(--dy)) rotate(var(--rot)) }
}
@keyframes tour-fade {
  0% { opacity: 0 } 25% { opacity: 1 } 55% { opacity: 1 } 100% { opacity: 0 }
}`;

type FinishBreakProps = {
  /** Called once, when the screen is fully covered. Switch workspaces here. */
  onCovered: () => void;
  onDone: () => void;
};

/**
 * "The app breaks and restarts fresh." The screen cracks, then falls away as
 * triangles to show the real workspace, already loaded underneath.
 *
 * No screenshot of the page is taken (no html2canvas): the shards are plain
 * theme-colored panels, so the cost is transform and opacity only. Reduced
 * motion gets a short crossfade instead.
 */
export function FinishBreak({ onCovered, onDone }: FinishBreakProps) {
  const reduced = useReducedMotion();
  const shards = useMemo(() => makeShards(), []);

  // Timers start once; the latest callbacks run when they fire.
  const callbacks = useRef({ onCovered, onDone });
  callbacks.current = { onCovered, onDone };

  useEffect(() => {
    const cover = window.setTimeout(
      () => callbacks.current.onCovered(),
      reduced ? FADE_COVER_MS : COVER_AT_MS,
    );
    const done = window.setTimeout(
      () => callbacks.current.onDone(),
      reduced ? FADE_TOTAL_MS : BREAK_TOTAL_MS,
    );
    return () => {
      window.clearTimeout(cover);
      window.clearTimeout(done);
    };
  }, [reduced]);

  if (reduced) {
    return (
      <div
        data-slot="finish-break"
        data-mode="fade"
        className="fixed inset-0 z-[70] bg-background"
        style={{ animation: `tour-fade ${FADE_TOTAL_MS}ms linear both` }}
      >
        <style>{KEYFRAMES}</style>
      </div>
    );
  }

  return (
    <div
      data-slot="finish-break"
      data-mode="shatter"
      className="fixed inset-0 z-[70] overflow-hidden"
    >
      <style>{KEYFRAMES}</style>
      {shards.map((shard) => (
        <div
          key={shard.id}
          className="absolute inset-0 bg-background"
          style={
            {
              clipPath: clipPath(shard.points),
              transformOrigin: `${shard.origin[0]}% ${shard.origin[1]}%`,
              "--dx": `${shard.dx}vw`,
              "--dy": `${shard.dy}vh`,
              "--rot": `${shard.rotate}deg`,
              animation: `tour-appear ${COVER_AT_MS}ms ease-out both, tour-fall ${FALL_MS}ms cubic-bezier(0.55, 0, 1, 0.45) ${COVER_AT_MS + shard.delay * 1000}ms both`,
              // Slight tint per shard so the cracks read as pieces of glass.
              filter: `brightness(${0.96 + (shard.id % 5) * 0.01})`,
            } as CSSProperties
          }
        />
      ))}
      <svg
        aria-hidden="true"
        className="absolute inset-0 size-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{
          animation: `tour-appear ${COVER_AT_MS}ms ease-out both, tour-vanish 250ms ease-out ${COVER_AT_MS + 100}ms both`,
        }}
      >
        {shards.map((shard) => (
          <polygon
            key={shard.id}
            points={shard.points.map((p) => p.join(",")).join(" ")}
            className="fill-none stroke-foreground/25"
            strokeWidth={0.18}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
    </div>
  );
}
