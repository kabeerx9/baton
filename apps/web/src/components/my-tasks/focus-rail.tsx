import { useTranslation } from "react-i18next";
import { Progress } from "@/components/ui/progress";
import type { AssignedTask } from "@/fetchers/task/get-assigned-tasks";
import { KeyLegend } from "./key-legend";
import { RepoFilter } from "./repo-filter";
import { RollingNumber } from "./rolling-number";
import { WeekBars } from "./week-bars";

/** The right rail: what is cleared, how the week looks, where the work sits. */
export function FocusRail({
  week,
  day,
  cleared,
  openCount,
  repos,
  repoId,
  onRepo,
}: {
  week: AssignedTask[][];
  day: number;
  /** Tasks finished on this visit. The API does not say what was done today. */
  cleared: number;
  /** Every open task on the page, whatever the repo filter says. */
  openCount: number;
  repos: { id: string; name: string; count: number }[];
  repoId: string | null;
  onRepo: (repoId: string | null) => void;
}) {
  const { t } = useTranslation();
  const total = cleared + openCount;
  return (
    <aside
      aria-label={t("workspace:myTasks.rail.label")}
      className="flex flex-col gap-7 lg:sticky lg:top-10 lg:self-start"
    >
      <section className="flex flex-col gap-2.5">
        <h2 className="font-semibold text-sm">
          {t("workspace:myTasks.rail.cleared")}
        </h2>
        <div className="flex items-baseline justify-between">
          <RollingNumber
            className="font-semibold text-[28px] leading-none tracking-tight"
            value={cleared}
          />
          <span className="text-muted-foreground text-xs tabular-nums">
            {t("workspace:myTasks.rail.clearedOf", { total })}
          </span>
        </div>
        <Progress
          aria-label={t("workspace:myTasks.rail.cleared")}
          max={Math.max(1, total)}
          value={cleared}
        />
      </section>
      <section className="flex flex-col gap-2">
        <h2 className="font-semibold text-sm">
          {t("workspace:myTasks.rail.week")}
        </h2>
        <WeekBars day={day} week={week} />
      </section>
      {repos.length > 1 ? (
        <section className="flex flex-col gap-1.5">
          <h2 className="flex items-baseline justify-between font-semibold text-sm">
            {t("workspace:myTasks.rail.repos")}
            {repoId ? (
              <button
                className="cursor-pointer rounded-sm font-normal text-muted-foreground text-xs underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => onRepo(null)}
                type="button"
              >
                {t("workspace:myTasks.rail.showAll")}
              </button>
            ) : null}
          </h2>
          <RepoFilter
            activeId={repoId}
            onChange={onRepo}
            repos={repos}
            total={openCount}
          />
        </section>
      ) : null}
      <section className="hidden border-t pt-5 lg:block">
        <h2 className="sr-only">{t("workspace:myTasks.rail.keys")}</h2>
        <KeyLegend />
      </section>
    </aside>
  );
}
