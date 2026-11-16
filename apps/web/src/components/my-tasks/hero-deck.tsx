import { AnimatePresence } from "motion/react";
import { useTranslation } from "react-i18next";
import type { AssignedTask } from "@/fetchers/task/get-assigned-tasks";
import type { FocusPlan } from "./focus-plan";
import { formatNames } from "./format-names";
import { HeroCard, type LeaveBy } from "./hero-card";
import { SmoothHeight } from "./smooth-height";
import { peopleWaiting, taskKey } from "./task-facts";

/**
 * The hero card on top of its queue. Two card edges show under it while more
 * tasks wait, and one line names the task that comes after.
 */
export function HeroDeck({
  plan,
  day,
  workspaceId,
  repoOf,
  leaveBy,
  onDone,
  onSkip,
  onMove,
  onFocus,
}: {
  plan: FocusPlan;
  day: number;
  workspaceId: string;
  repoOf: (task: AssignedTask) => string;
  leaveBy: LeaveBy;
  onDone: (task: AssignedTask) => void;
  onSkip: (task: AssignedTask) => void;
  onMove: (task: AssignedTask, date: Date | null) => void;
  onFocus: (task: AssignedTask) => void;
}) {
  const { t } = useTranslation();
  const { next, queue } = plan;
  const after: AssignedTask | undefined = queue[1];

  if (!next) {
    return (
      <p className="rounded-2xl border border-dashed p-8 text-center text-muted-foreground text-sm">
        {plan.held.length > 0
          ? t("workspace:myTasks.hero.nothingFree")
          : t("workspace:myTasks.hero.clear")}
      </p>
    );
  }

  const afterNames = after ? peopleWaiting(after) : [];
  return (
    <div className="flex flex-col gap-3">
      <SmoothHeight>
        <div className="relative pb-4">
          {queue.length > 2 ? (
            <span
              aria-hidden="true"
              className="absolute inset-x-7 bottom-0 h-12 rounded-2xl border bg-card shadow-xs/5"
            />
          ) : null}
          {queue.length > 1 ? (
            <span
              aria-hidden="true"
              className="absolute inset-x-3.5 bottom-2 h-12 rounded-2xl border bg-card shadow-xs/5"
            />
          ) : null}
          <AnimatePresence custom={leaveBy} initial={false} mode="popLayout">
            <HeroCard
              day={day}
              key={next.id}
              onDone={() => onDone(next)}
              onMove={(date) => onMove(next, date)}
              onSkip={() => onSkip(next)}
              reason={plan.reason}
              repo={repoOf(next)}
              task={next}
              workspaceId={workspaceId}
            />
          </AnimatePresence>
        </div>
      </SmoothHeight>
      {after ? (
        <div className="flex items-center gap-2 px-1 text-xs">
          <span className="shrink-0 text-muted-foreground">
            {t("workspace:myTasks.hero.afterThis")}
          </span>
          <button
            className="group flex min-w-0 cursor-pointer items-center gap-2 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => onFocus(after)}
            title={t("workspace:myTasks.hero.doNow")}
            type="button"
          >
            <span className="font-medium text-muted-foreground tabular-nums">
              {taskKey(after)}
            </span>
            <span className="truncate decoration-foreground/25 underline-offset-4 group-hover:underline">
              {after.title}
            </span>
          </button>
          {afterNames.length > 0 ? (
            <span className="hidden shrink-0 text-warning-foreground sm:inline">
              {t("workspace:myTasks.hero.waits", {
                count: afterNames.length,
                names: formatNames(afterNames),
              })}
            </span>
          ) : null}
          {queue.length > 2 ? (
            <span className="ms-auto shrink-0 text-muted-foreground tabular-nums">
              {t("workspace:myTasks.hero.more", { count: queue.length - 2 })}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
