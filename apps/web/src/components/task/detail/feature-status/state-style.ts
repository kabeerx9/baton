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
