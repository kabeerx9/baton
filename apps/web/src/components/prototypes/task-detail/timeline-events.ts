import type { TaskView } from "./derive";
import type { ActivityEntry, Linked, TaskDetail } from "./types";

/** One row of the Pulse timeline. `now` is a live marker, never stored. */
export type TimelineItem =
  | { kind: "now"; id: "now"; waitingOn: Linked[]; waitedBy: Linked[] }
  | { kind: "entry"; id: string; entry: ActivityEntry };

export type TimelineFilter = "all" | "comments" | "changes";

/**
 * Newest first. The `now` marker leads, so a sparse task still has a
 * present moment to look at, not an empty list.
 */
export function buildTimeline(
  task: TaskDetail,
  view: TaskView,
  filter: TimelineFilter,
): TimelineItem[] {
  const entries = [...task.activity]
    .sort((a, b) => a.hoursAgo - b.hoursAgo)
    .filter((e) =>
      filter === "all"
        ? true
        : filter === "comments"
          ? e.kind === "comment"
          : e.kind !== "comment",
    )
    .map((entry): TimelineItem => ({ kind: "entry", id: entry.id, entry }));
  return filter === "all"
    ? [
        {
          kind: "now",
          id: "now",
          waitingOn: view.openBlockers,
          waitedBy: view.waitingOnMe,
        },
        ...entries,
      ]
    : entries;
}
