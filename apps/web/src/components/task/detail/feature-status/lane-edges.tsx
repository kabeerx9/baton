import type { EdgeShape } from "./use-edge-paths";

/** The "waits on" lines, drawn over the map. They draw in once, then rest. */
export function LaneEdges({
  width,
  height,
  paths,
}: {
  width: number;
  height: number;
  paths: EdgeShape[];
}) {
  if (paths.length === 0) return null;
  return (
    <svg
      aria-hidden="true"
      width={width}
      height={height}
      className="pointer-events-none absolute inset-0 text-amber-500"
    >
      <defs>
        <marker
          id="lane-arrow"
          viewBox="0 0 6 6"
          refX="5"
          refY="3"
          markerWidth="6"
          markerHeight="6"
          orient="auto"
        >
          <path d="M0,0 L6,3 L0,6 z" fill="currentColor" />
        </marker>
      </defs>
      {paths.map((p, i) => (
        <path
          key={p.id}
          d={p.d}
          pathLength={1}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          markerEnd="url(#lane-arrow)"
          className="fs-draw"
          style={{ animationDelay: `${180 + i * 80}ms` }}
        />
      ))}
    </svg>
  );
}
