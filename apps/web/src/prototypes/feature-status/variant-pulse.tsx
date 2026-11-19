import { AttentionList } from "./attention-list";
import { BarLegend } from "./bar-legend";
import { FeatureHero } from "./feature-hero";
import type { FeatureSummary } from "./feature-status";
import { LinkChips } from "./link-chips";
import { OwnerLoadRow } from "./owner-load";
import type { Scenario } from "./scenario-types";
import { SegmentBar } from "./segment-bar";

/**
 * Pulse. Density: a compact summary. One number, one segmented bar with a
 * segment per task, then only what is stuck. The task list stays below.
 */
export function VariantPulse({
  scenario,
  summary,
}: {
  scenario: Scenario;
  summary: FeatureSummary;
}) {
  const { counts, total } = summary;
  return (
    <FeatureHero
      scenario={scenario}
      summary={summary}
      bar={
        <div className="flex flex-col gap-5 pt-1">
          <div className="flex flex-col gap-3">
            <p className="flex items-baseline gap-2">
              <span className="font-semibold text-5xl tabular-nums tracking-tight">
                {counts.done}
              </span>
              <span className="text-2xl text-muted-foreground tabular-nums">
                of {total}
              </span>
              <span className="text-muted-foreground text-sm">tasks done</span>
            </p>
            <SegmentBar tasks={scenario.feature.subtasks} held={summary.held} />
            <BarLegend summary={summary} />
          </div>
          <AttentionList held={summary.held} />
          {summary.status.kind !== "done" && (
            <OwnerLoadRow owners={summary.owners} />
          )}
          <LinkChips waitsOn={summary.waitsOn} blocks={summary.blocks} />
        </div>
      }
    />
  );
}
