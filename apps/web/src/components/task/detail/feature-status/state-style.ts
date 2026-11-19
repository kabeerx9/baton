import type { Status } from "@/components/board/model";

/** Fill for a task's column. Blocked and asked are drawn as separate signals. */
export const COLUMN_FILL: Record<Status, string> = {
  done: "bg-emerald-500",
  review: "bg-emerald-500/45",
  doing: "bg-blue-500",
  todo: "bg-muted-foreground/25",
};

export const BLOCKED_DOT = "bg-amber-500";
export const ASKED_DOT = "bg-violet-500";

export const NODE_BASE =
  "flex min-w-0 items-center gap-1 rounded-lg border bg-card px-1 py-1 font-mono text-[9px] sm:gap-1.5 sm:px-1.5 sm:text-[10px]";
