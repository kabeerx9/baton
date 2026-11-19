import { useTranslation } from "react-i18next";
import type { BoardTask } from "@/components/board/model";
import { AttentionList } from "./attention-list";
import { BarLegend } from "./bar-legend";
import type { FeatureSummary } from "./feature-status";
import { LinkChips } from "./link-chips";
import { OwnerLoadRow } from "./owner-load";
import { SegmentBar } from "./segment-bar";

/**
 * The status area of a feature: one number, one segmented bar with a segment
 * per task, then only what is stuck. The task list stays below the hero.
 */
export function FeaturePulse({
  feature,
  summary,
}: {
  feature: BoardTask;
  summary: FeatureSummary;
}) {
  const { t } = useTranslation();
  const { counts, total } = summary;
  return (
    <div className="flex flex-col gap-5 pt-1">
      <div className="flex flex-col gap-3">
        <p className="flex items-baseline gap-2">
          <span className="font-semibold text-5xl tabular-nums tracking-tight">
            {counts.done}
          </span>
          <span className="text-2xl text-muted-foreground tabular-nums">
            {t("tasks:hero.feature.pulse.of", { total })}
          </span>
          <span className="text-muted-foreground text-sm">
            {t("tasks:hero.feature.pulse.tasksDone")}
          </span>
        </p>
        <SegmentBar tasks={feature.subtasks} held={summary.held} />
        <BarLegend summary={summary} />
      </div>
      <AttentionList held={summary.held} />
      {summary.status.kind !== "done" && (
        <OwnerLoadRow owners={summary.owners} />
      )}
      <LinkChips waitsOn={summary.waitsOn} blocks={summary.blocks} />
    </div>
  );
}
