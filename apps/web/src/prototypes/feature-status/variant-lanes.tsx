import { FeatureHero } from "./feature-hero";
import type { FeatureSummary } from "./feature-status";
import { LaneMap } from "./lane-map";
import { OwnerLoadRow } from "./owner-load";
import type { Scenario } from "./scenario-types";

/**
 * Lanes. Visual: a map. The board's four columns side by side, a node per task,
 * and amber lines for "waits on". Where work sits is the answer.
 */
export function VariantLanes({
  scenario,
  summary,
}: {
  scenario: Scenario;
  summary: FeatureSummary;
}) {
  return (
    <FeatureHero
      scenario={scenario}
      summary={summary}
      bar={
        <div className="flex flex-col gap-4 pt-1">
          <LaneMap scenario={scenario} summary={summary} />
          {summary.status.kind !== "done" && (
            <OwnerLoadRow owners={summary.owners} />
          )}
        </div>
      }
    />
  );
}
