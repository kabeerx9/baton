import { useTranslation } from "react-i18next";
import type { FeatureSummary } from "./feature-status";

/** The one sentence under a feature's title. Each part has its own static key. */
export function FeatureHeadline({ summary }: { summary: FeatureSummary }) {
  const { t } = useTranslation();
  const { status, counts, total, held, waitsOn, blocks } = summary;
  const blocked = held.filter((h) => h.kind === "blocked").length;
  const asked = held.length - blocked;
  const waits =
    waitsOn.length > 0
      ? ` ${t("tasks:hero.feature.headline.waitsOnFeature", {
          count: waitsOn.length,
          keys: waitsOn.map((x) => x.key).join(", "),
        })}`
      : "";

  switch (status.kind) {
    case "empty":
      return <>{t("tasks:hero.feature.headline.empty")}</>;
    case "done":
      return (
        <>
          {t("tasks:hero.feature.headline.done", { count: total })}
          {blocks.length > 0 &&
            ` ${t("tasks:hero.feature.headline.released", { count: blocks.length })}`}
        </>
      );
    case "notStarted":
      return (
        <>
          {t("tasks:hero.feature.headline.notStarted", { count: total })}
          {waits}
        </>
      );
    case "asking":
      return <>{t("tasks:hero.feature.headline.asking")}</>;
    case "stuck":
      return <>{t("tasks:hero.feature.headline.stuck")}</>;
    case "moving": {
      const lead = t("tasks:hero.feature.headline.progress", {
        done: counts.done,
        total,
      });
      const trouble = [
        blocked > 0
          ? t("tasks:hero.feature.headline.blocked", { count: blocked })
          : null,
        asked > 0
          ? t("tasks:hero.feature.headline.asked", { count: asked })
          : null,
      ].filter(Boolean);
      return (
        <>
          {lead}{" "}
          {trouble.length > 0
            ? `${trouble.join(", ")}.`
            : t("tasks:hero.feature.headline.inProgress", {
                count: counts.doing + counts.review,
              })}
          {waits}
        </>
      );
    }
  }
}
