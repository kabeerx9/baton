import { addDays } from "date-fns";
import { useTranslation } from "react-i18next";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@/components/ui/tooltip";
import type { AssignedTask } from "@/fetchers/task/get-assigned-tasks";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format";
import { taskKey } from "./task-facts";

const LISTED = 4;

/** Seven bars, one per day from today. A bar names its tasks on hover or focus. */
export function WeekBars({
  week,
  day,
}: {
  week: AssignedTask[][];
  day: number;
}) {
  const { t } = useTranslation();
  const peak = Math.max(1, ...week.map((tasks) => tasks.length));
  return (
    <ol
      aria-label={t("workspace:myTasks.rail.weekLabel")}
      className="flex h-[92px] items-end gap-1"
    >
      {week.map((tasks, i) => {
        const date = addDays(new Date(day), i);
        const count = tasks.length;
        const title =
          i === 0
            ? t("workspace:myWork.due.today")
            : formatDate(date, {
                weekday: "long",
                day: "numeric",
                month: "short",
              });
        return (
          <li className="flex flex-1" key={date.toISOString()}>
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    aria-label={t("workspace:myTasks.rail.dayDue", {
                      count,
                      date: title,
                    })}
                    className="group flex flex-1 cursor-default flex-col items-center gap-1.5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    type="button"
                  />
                }
              >
                <span className="h-4 text-[11px] text-muted-foreground tabular-nums">
                  {count || ""}
                </span>
                <span
                  aria-hidden="true"
                  className={cn(
                    "w-full rounded-[5px] transition-[height,background-color] duration-300 ease-(--ease-out) motion-reduce:transition-none",
                    i === 0
                      ? "bg-primary"
                      : "bg-foreground/12 group-hover:bg-foreground/22",
                    count === 0 && "bg-foreground/8",
                  )}
                  style={{ height: `${Math.max(3, (count / peak) * 44)}px` }}
                />
                <span
                  className={cn(
                    "text-[11px]",
                    i === 0 ? "font-semibold" : "text-muted-foreground",
                  )}
                >
                  {formatDate(date, { weekday: "narrow" })}
                </span>
              </TooltipTrigger>
              <TooltipPopup className="flex max-w-64 flex-col items-start gap-0.5 text-left">
                <span className="font-medium">{title}</span>
                {count === 0 ? (
                  <span className="text-muted-foreground">
                    {t("workspace:myTasks.rail.nothingDue")}
                  </span>
                ) : null}
                {tasks.slice(0, LISTED).map((task) => (
                  <span className="max-w-full truncate" key={task.id}>
                    <span className="text-muted-foreground tabular-nums">
                      {taskKey(task)}
                    </span>{" "}
                    {task.title}
                  </span>
                ))}
                {count > LISTED ? (
                  <span className="text-muted-foreground">
                    {t("workspace:myTasks.rail.andMore", {
                      count: count - LISTED,
                    })}
                  </span>
                ) : null}
              </TooltipPopup>
            </Tooltip>
          </li>
        );
      })}
    </ol>
  );
}
