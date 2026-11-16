import { AnimatePresence } from "motion/react";
import { useMemo, useState } from "react";
import { Tabs, TabsList, TabsTab } from "@/components/ui/tabs";
import type { PageProps } from "../../page-props";
import { CommentComposer } from "../../shared/comment-composer";
import { buildTimeline, type TimelineFilter } from "../../timeline-events";
import { PulseTimelineItem } from "./timeline-item";

const FILTERS: { value: TimelineFilter; label: string }[] = [
  { value: "all", label: "Everything" },
  { value: "comments", label: "Comments" },
  { value: "changes", label: "Changes" },
];

/** The main column: a filter, a composer, then what happened, newest first. */
export function PulseTimeline({ task, view, viewer, dispatch }: PageProps) {
  const [filter, setFilter] = useState<TimelineFilter>("all");
  const items = useMemo(
    () => buildTimeline(task, view, filter),
    [task, view, filter],
  );
  return (
    <section aria-label="Timeline" className="min-w-0">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">What happened</h2>
        <Tabs
          value={filter}
          onValueChange={(v) => setFilter(v as TimelineFilter)}
        >
          {/* The picker owns ← and →; keep them inside the tab list. */}
          <TabsList
            onKeyDown={(e) => {
              if (e.key.startsWith("Arrow")) e.stopPropagation();
            }}
          >
            {FILTERS.map((f) => (
              <TabsTab key={f.value} value={f.value} className="px-2.5 text-xs">
                {f.label}
              </TabsTab>
            ))}
          </TabsList>
        </Tabs>
      </div>
      <CommentComposer
        dispatch={dispatch}
        author={viewer.person}
        className="mb-6"
      />
      <div className="relative">
        <span
          className="absolute top-2 bottom-2 left-4 w-px bg-border"
          aria-hidden="true"
        />
        <ol className="space-y-6">
          <AnimatePresence initial>
            {items.map((item, i) => (
              <PulseTimelineItem
                key={`${filter}-${item.id}`}
                item={item}
                index={i}
              />
            ))}
          </AnimatePresence>
        </ol>
        {items.length === 0 && (
          <p className="pl-10 text-sm text-muted-foreground">
            Nothing here yet.
          </p>
        )}
      </div>
    </section>
  );
}
