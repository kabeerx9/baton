import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { AssignedTaskRow } from "@/components/my-work/assigned-task-row";
import type { DueBucket } from "@/components/my-work/due-bucket";
import {
  groupAssignedTasksByDueDate,
  groupAssignedTasksByProject,
} from "@/components/my-work/group-assigned-tasks";
import type { AssignedTask } from "@/fetchers/task/get-assigned-tasks";
import { useBoardProjectId } from "@/hooks/queries/board/use-board-project-id";
import { useLocalDay } from "@/hooks/use-local-day";
import { cn } from "@/lib/cn";
import { repoLabel } from "@/components/my-work/repo-label";
import type { MyTasksGroupBy } from "./my-tasks-group-by";

type MyTasksListProps = {
  tasks: AssignedTask[];
  total: number;
  groupBy: MyTasksGroupBy;
  workspaceId: string;
};

export function MyTasksList({
  tasks,
  total,
  groupBy,
  workspaceId,
}: MyTasksListProps) {
  const { t } = useTranslation();
  const day = useLocalDay();
  const boardProjectId = useBoardProjectId(workspaceId);
  // Tasks that block someone else's open work come first, in their own
  // section, so a backend ask is not lost among everything else.
  const blocking = useMemo(
    () => tasks.filter((task) => task.waiting.length > 0),
    [tasks],
  );
  const groups = useMemo(() => {
    const rest = tasks.filter((task) => task.waiting.length === 0);
    return groupBy === "project"
      ? groupAssignedTasksByProject(rest)
      : groupAssignedTasksByDueDate(rest, new Date(day));
  }, [tasks, groupBy, day]);

  const bucketTitles: Record<DueBucket, string> = {
    overdue: t("workspace:myWork.due.overdue"),
    today: t("workspace:myWork.due.today"),
    thisWeek: t("workspace:myWork.due.thisWeek"),
    later: t("workspace:myWork.due.later"),
    noDueDate: t("workspace:myWork.due.noDueDate"),
  };

  return (
    <div className="flex flex-col">
      {blocking.length > 0 && (
        <section>
          <h2 className="flex h-9 items-center gap-2 border-border/50 border-b bg-amber-500/10 px-5 text-[13px]">
            <span className="font-semibold text-amber-700 dark:text-amber-400">
              Waiting on you
            </span>
            <span className="font-normal text-muted-foreground text-xs tabular-nums">
              {blocking.length}
            </span>
          </h2>
          <div className="flex flex-col px-4">
            {blocking.map((task) => (
              <div key={task.id}>
                <AssignedTaskRow
                  task={task}
                  workspaceId={workspaceId}
                  showLabels
                />
                <p className="-mt-1.5 pb-2 pl-[104px] text-amber-700 text-xs dark:text-amber-400">
                  Blocks{" "}
                  {task.waiting
                    .map(
                      (w) =>
                        `${w.key} ${w.title}${w.assigneeName ? ` (${w.assigneeName.split(" ")[0]})` : ""}`,
                    )
                    .join(", ")}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
      {groups.map((group) => (
        <section key={group.id}>
          <h2 className="flex h-9 items-center gap-2 border-border/50 border-b bg-muted/40 px-5 text-[13px]">
            <span
              className={cn(
                "font-semibold",
                group.bucket === "overdue"
                  ? "text-destructive-foreground"
                  : "text-foreground",
              )}
            >
              {group.bucket
                ? bucketTitles[group.bucket]
                : repoLabel(
                    { id: group.id, name: group.title ?? "" },
                    boardProjectId,
                    t("workspace:myTasks.noRepo"),
                  )}
            </span>
            <span className="font-normal text-muted-foreground text-xs tabular-nums">
              {group.tasks.length}
            </span>
          </h2>
          <div className="flex flex-col px-4">
            {group.tasks.map((task) => (
              <AssignedTaskRow
                key={task.id}
                task={task}
                workspaceId={workspaceId}
                showLabels
              />
            ))}
          </div>
        </section>
      ))}
      {total > tasks.length && (
        <p className="px-5 py-3 text-muted-foreground text-xs">
          {t("workspace:myTasks.truncated", {
            shown: tasks.length,
            total,
          })}
        </p>
      )}
    </div>
  );
}
