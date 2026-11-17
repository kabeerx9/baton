import { useState } from "react";
import { useTranslation } from "react-i18next";
import { OptionMenu } from "@/components/common/option-menu/option-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useUpdateTaskStatus } from "@/hooks/mutations/task/use-update-task-status";
import { useGetColumns } from "@/hooks/queries/column/use-get-columns";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { toast } from "@/lib/toast";
import { useTaskStatusStore } from "@/store/task-status/store";
import {
  isStatusLocked,
  moveOf,
  shownStatus,
} from "@/store/task-status/transition";
import type Task from "@/types/task";
import { disabledTrigger } from "./disabled-trigger";
import { statusMenuOptions } from "./menus/status-menu-options";

type TaskStatusPopoverProps = {
  task: Task;
  children: React.ReactNode;
};

export default function TaskStatusPopover({
  task,
  children,
}: TaskStatusPopoverProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const {
    data: columns = [],
    isLoading,
    isError,
  } = useGetColumns(task.projectId);
  const { mutateAsync: updateTaskStatus } = useUpdateTaskStatus();
  const { canUpdateTasks } = useWorkspacePermission();
  const entry = useTaskStatusStore((s) => s.entries[task.id]);

  if (!canUpdateTasks()) return <>{children}</>;
  // "deny", or a write that holds the task: the control shows, and stays shut.
  if (moveOf(task.statusChange) === "deny" || isStatusLocked(entry))
    return <>{disabledTrigger(children)}</>;

  const changeStatus = async (status: string) => {
    setOpen(false);
    try {
      await updateTaskStatus({
        ...task,
        status,
        isFinal: columns.find((column) => column.slug === status)?.isFinal,
      });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("tasks:popover.status.updateError"),
      );
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-60 p-0" align="start">
        <OptionMenu
          label={t("tasks:status.label")}
          placeholder={t("tasks:bulk.statusPlaceholder")}
          options={statusMenuOptions(columns, shownStatus(task, entry))}
          onSelect={changeStatus}
          status={
            isLoading ? (
              t("common:empty.loading")
            ) : isError ? (
              <span className="text-destructive-foreground">
                {t("common:error.title")}
              </span>
            ) : undefined
          }
        />
      </PopoverContent>
    </Popover>
  );
}
