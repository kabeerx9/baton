import type { Status } from "./model";

// Linear-style status glyph: empty ring, half ring, three-quarter ring, filled check.
export function StatusIcon({
  status,
  blocked,
  size = 14,
}: {
  status: Status;
  blocked?: boolean;
  size?: number;
}) {
  if (blocked) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 14 14"
        aria-label="Blocked"
        className="shrink-0 text-amber-500"
      >
        <circle
          cx="7"
          cy="7"
          r="6"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path
          d="M4.5 7h5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (status === "done") {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 14 14"
        aria-label="Done"
        className="shrink-0 text-emerald-500"
      >
        <circle cx="7" cy="7" r="7" fill="currentColor" />
        <path
          d="M4.2 7.2l1.9 1.9 3.8-4"
          fill="none"
          stroke="white"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  const fill = status === "doing" ? 0.5 : status === "review" ? 0.75 : 0;
  const tone =
    status === "review"
      ? "text-emerald-500"
      : status === "doing"
        ? "text-amber-500"
        : "text-muted-foreground";
  const r = 3;
  const c = 2 * Math.PI * r;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 14 14"
      aria-label={status}
      className={`shrink-0 ${tone}`}
    >
      <circle
        cx="7"
        cy="7"
        r="6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeDasharray={fill ? undefined : "2 1.6"}
      />
      {fill > 0 && (
        <circle
          cx="7"
          cy="7"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={r * 2}
          strokeDasharray={`${c * fill} ${c}`}
          transform="rotate(-90 7 7)"
        />
      )}
    </svg>
  );
}
