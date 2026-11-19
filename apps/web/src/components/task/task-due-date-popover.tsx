import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useUpdateTaskDueDate } from "@/hooks/mutations/task/use-update-task-due-date";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { toast } from "@/lib/toast";
import type Task from "@/types/task";
import TaskDueDatePicker from "./task-due-date-picker";

type TaskDueDatePopoverProps = {
  task: Task;
  children: React.ReactNode;
};

export default function TaskDueDatePopover({
  task,
  children,
}: TaskDueDatePopoverProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { mutateAsync: updateTaskDueDate } = useUpdateTaskDueDate();
  const { canWorkOnTask } = useWorkspacePermission();
  const canEdit = canWorkOnTask(task.userId);
  const dueDate = useMemo(
    () => (task.dueDate ? new Date(task.dueDate) : null),
    [task.dueDate],
  );
  const startDate = useMemo(
    () => (task.startDate ? new Date(task.startDate) : undefined),
    [task.startDate],
  );

  const handleDateChange = async (date: Date | null) => {
    try {
      await updateTaskDueDate({
        ...task,
        dueDate: date?.toISOString() ?? null,
      });
      setOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("tasks:popover.dueDate.updateError"),
      );
    }
  };

  if (!canEdit) return <>{children}</>;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-65 p-0" align="start">
        <TaskDueDatePicker
          label={t("tasks:dueDate.label")}
          clearLabel={t("tasks:popover.dueDate.clear")}
          dueDate={dueDate}
          startDate={startDate}
          onDateChange={handleDateChange}
        />
      </PopoverContent>
    </Popover>
  );
}
