import { describe, expect, it } from "vite-plus/test";
import { deriveTaskView } from "./derive";
import { DATA_SETS } from "./mock-data";
import { KABEER } from "./people";
import { buildTimeline } from "./timeline-events";

const me = { person: KABEER, involved: true };

describe("buildTimeline", () => {
  it("leads with now, then newest first", () => {
    const task = DATA_SETS.busy.task;
    const items = buildTimeline(task, deriveTaskView(task, me), "all");
    expect(items[0]?.kind).toBe("now");
    const hours = items.flatMap((i) =>
      i.kind === "entry" ? [i.entry.hoursAgo] : [],
    );
    expect(hours).toEqual([...hours].sort((a, b) => a - b));
  });

  it("filters to comments and drops the now marker", () => {
    const task = DATA_SETS.busy.task;
    const items = buildTimeline(task, deriveTaskView(task, me), "comments");
    expect(
      items.every((i) => i.kind === "entry" && i.entry.kind === "comment"),
    ).toBe(true);
  });

  it("still has a now marker for a sparse task", () => {
    const task = DATA_SETS.a.task;
    expect(buildTimeline(task, deriveTaskView(task, me), "all")).toHaveLength(
      2,
    );
  });
});
