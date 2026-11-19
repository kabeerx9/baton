import { useTranslation } from "react-i18next";
import { STATUS_LABEL } from "@/components/board/model";
import { COLUMN_ORDER, type FeatureSummary } from "./feature-status";
import { ASKED_DOT, BLOCKED_DOT, COLUMN_FILL } from "./state-style";

/** The counts per column, in the order of the bar. Empty columns stay out. */
export function BarLegend({ summary }: { summary: FeatureSummary }) {
  const { t } = useTranslation();
  const blocked = summary.held.filter((h) => h.kind === "blocked").length;
  const asked = summary.held.length - blocked;
  const items = [
    ...[...COLUMN_ORDER].reverse().map((status) => ({
      key: status,
      dot: COLUMN_FILL[status],
      count: summary.counts[status],
      label: STATUS_LABEL[status],
    })),
    {
      key: "blocked",
      dot: BLOCKED_DOT,
      count: blocked,
      label: t("tasks:hero.feature.legend.blocked"),
    },
    {
      key: "asked",
      dot: ASKED_DOT,
      count: asked,
      label: t("tasks:hero.feature.legend.asked"),
    },
  ].filter((item) => item.count > 0);
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground text-xs">
      {items.map((item) => (
        <li key={item.key} className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className={`size-2 rounded-full ${item.dot}`}
          />
          <span className="font-medium text-foreground tabular-nums">
            {item.count}
          </span>
          {item.label}
        </li>
      ))}
    </ul>
  );
}
