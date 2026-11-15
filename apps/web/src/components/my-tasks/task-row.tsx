import { CrosshairIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import type { AssignedTask } from "@/fetchers/task/get-assigned-tasks";
import { DoneButton } from "./done-button";
import { DueText } from "./due-text";
import { finishBlockText } from "./finish-block-text";
import { formatNames } from "./format-names";
import { HeldChip } from "./held-chip";
import { LabelDots } from "./label-dots";
import { PendingMark } from "./pending-mark";
import { PeopleStack } from "./people-stack";
import { PriorityMark } from "./priority-mark";
import { finishBlock, isBlocking, peopleWaiting, taskKey } from "./task-facts";
import { TaskLink } from "./task-link";

/** One row in a section. The round control finishes the task; "Do next" promotes it. */
export function TaskRow({
  task,
  day,
  workspaceId,
  onDone,
  onFocus,
}: {
  task: AssignedTask;
  day: number;
  workspaceId: string;
  onDone: () => void;
  onFocus: () => void;
}) {
  const { t } = useTranslation();
  const names = peopleWaiting(task);
  const key = taskKey(task);
  return (
    <div
      className="group relative flex min-h-11 items-center gap-3 px-3.5 py-2 transition-colors duration-100 before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-foreground before:opacity-0 hover:bg-accent/40 has-[[data-row-focus]:focus-visible]:bg-accent/60 has-[[data-row-focus]:focus-visible]:before:opacity-100"
      data-task-id={task.id}
    >
      <DoneButton
        blocked={finishBlockText(t, task)}
        label={t("workspace:myTasks.row.markDone", { key })}
        onDone={onDone}
      />
      <PriorityMark priority={task.priority} />
      <span className="hidden w-14 shrink-0 truncate font-medium text-muted-foreground text-xs tabular-nums sm:block">
        {key}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <TaskLink
          className="truncate text-sm outline-none decoration-foreground/25 underline-offset-4 hover:underline"
          data-row-focus=""
          task={task}
          workspaceId={workspaceId}
        >
          {task.title}
        </TaskLink>
        {isBlocking(task) ? (
          <span className="flex items-center gap-1.5 truncate text-warning-foreground text-xs">
            <PeopleStack
              names={task.waiting.map((w) => w.assigneeName)}
              size={14}
            />
            {names.length > 0
              ? t("workspace:myTasks.row.waiting", {
                  count: names.length,
                  names: formatNames(names),
                })
              : t("workspace:myTasks.row.tasksWaiting", {
                  count: task.waiting.length,
                })}
          </span>
        ) : null}
      </div>
      <HeldChip task={task} />
      <PendingMark task={task} workspaceId={workspaceId} />
      <LabelDots
        className="hidden w-28 shrink-0 lg:flex"
        labels={task.labels}
        max={1}
      />
      {finishBlock(task) === "held" ? null : (
        <Button
          aria-label={t("workspace:myTasks.row.doNextLabel", { key })}
          className="opacity-0 transition-opacity duration-150 focus-visible:opacity-100 group-hover:opacity-100 group-has-[[data-row-focus]:focus-visible]:opacity-100 pointer-coarse:opacity-100"
          onClick={onFocus}
          size="xs"
          variant="ghost"
        >
          <CrosshairIcon />
          {t("workspace:myTasks.row.doNext")}
        </Button>
      )}
      <DueText
        className="w-[4.5rem] shrink-0 text-right"
        dueDate={task.dueDate}
        day={day}
      />
    </div>
  );
}
