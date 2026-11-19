import { useTranslation } from "react-i18next";
import type { BoardTask } from "@/components/board/model";
import type { FeatureSummary } from "./feature-status";
import { LaneMap } from "./lane-map";

/**
 * The lanes map in its own quiet section under the hero. The page mounts it
 * only when `summary.connected` is true.
 */
export function FeatureLanes({
  feature,
  summary,
}: {
  feature: BoardTask;
  summary: FeatureSummary;
}) {
  const { t } = useTranslation();
  return (
    <section
      aria-label={t("tasks:hero.feature.lanes.title")}
      className="mt-6 rounded-2xl border bg-card/40 px-4 py-4 sm:px-6"
    >
      <h2 className="mb-3 font-semibold text-[11px] text-muted-foreground uppercase tracking-wider">
        {t("tasks:hero.feature.lanes.title")}
      </h2>
      <LaneMap feature={feature} summary={summary} />
    </section>
  );
}
