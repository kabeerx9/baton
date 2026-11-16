import { motion } from "motion/react";
import { columnHeight, nodeCenter } from "./geometry";

const W = 72;

/**
 * Curves from each node to the core. `live` wires carry a moving dash: the
 * baton is on its way. Settled wires are solid and quiet.
 */
export function Wires({
  count,
  side,
  live,
  color,
  delay = 0,
}: {
  count: number;
  side: "in" | "out";
  live: boolean;
  /** A CSS color. */
  color: string;
  delay?: number;
}) {
  const h = columnHeight(count);
  const mid = h / 2;
  const nodes = Math.max(count, 1);
  return (
    <svg
      width={W}
      height={h}
      viewBox={`0 0 ${W} ${h}`}
      className="hidden shrink-0 md:block"
      aria-hidden="true"
    >
      {Array.from({ length: nodes }, (_, i) => {
        const y = nodeCenter(i);
        const d =
          side === "in"
            ? `M 0 ${y} C ${W / 2} ${y}, ${W / 2} ${mid}, ${W} ${mid}`
            : `M 0 ${mid} C ${W / 2} ${mid}, ${W / 2} ${y}, ${W} ${y}`;
        return (
          <g key={i}>
            <motion.path
              d={d}
              fill="none"
              stroke={color}
              strokeOpacity={live ? 0.25 : 0.5}
              strokeWidth={2}
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{
                duration: 0.5,
                ease: [0.23, 1, 0.32, 1],
                delay: delay + i * 0.06,
              }}
            />
            {live && (
              <path
                d={d}
                fill="none"
                stroke={color}
                strokeWidth={2}
                strokeLinecap="round"
                strokeDasharray="4 6"
                className="motion-wire-flow"
              />
            )}
          </g>
        );
      })}
    </svg>
  );
}
