import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { formatDate } from "@/lib/format";
import { type FocusPlan, headline, summaryParts } from "./focus-plan";
import { headlineText } from "./headline-text";

const SUMMARY: Record<
  ReturnType<typeof summaryParts>[number]["part"],
  (t: TFunction) => string
> = {
  overdue: (t) => t("workspace:myTasks.summary.overdue"),
  today: (t) => t("workspace:myTasks.summary.today"),
  week: (t) => t("workspace:myTasks.summary.week"),
  held: (t) => t("workspace:myTasks.summary.held"),
};

/** The date, the one sentence that sums up the day, and the counts behind it. */
export function FocusHeader({
  plan,
  day,
  shown,
  total,
}: {
  plan: FocusPlan;
  day: number;
  /** Tasks the API sent, and how many are open in all. They differ past the page limit. */
  shown: number;
  total: number;
}) {
  const { t } = useTranslation();
  const parts = summaryParts(plan);
  return (
    <header className="flex flex-col gap-2">
      <span className="font-medium text-[11px] text-muted-foreground uppercase tracking-[0.1em]">
        {formatDate(day, { weekday: "long", day: "numeric", month: "long" })}
      </span>
      <h1 className="max-w-[22ch] text-balance font-semibold text-[34px] leading-[1.08] tracking-tight">
        {headlineText(t, headline(plan))}
      </h1>
      {parts.length > 0 ? (
        <p className="flex flex-wrap gap-x-1.5 text-muted-foreground text-sm">
          {parts.map(({ part, count }, i) => (
            <span key={part}>
              {i > 0 ? (
                <span aria-hidden="true" className="pr-1.5">
                  ·
                </span>
              ) : null}
              <span className="font-medium text-foreground tabular-nums">
                {count}
              </span>{" "}
              {SUMMARY[part](t)}
            </span>
          ))}
        </p>
      ) : null}
      {total > shown ? (
        <p className="text-muted-foreground text-xs">
          {t("workspace:myTasks.truncated", { shown, total })}
        </p>
      ) : null}
    </header>
  );
}
