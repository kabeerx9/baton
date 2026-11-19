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

type SubtaskStatusPopoverProps = {
  tasks: Task[];
  projectId: string;
  children: React.ReactNode;
};

export default function SubtaskStatusPopover({
  tasks,
  projectId,
  children,
}: SubtaskStatusPopoverProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { data: columns = [] } = useGetColumns(projectId);
  const { mutateAsync: updateTaskStatus } = useUpdateTaskStatus();
  const { canWorkOnTask } = useWorkspacePermission();
  const entries = useTaskStatusStore((s) => s.entries);

  const shown = tasks.map((task) => shownStatus(task, entries[task.id]));
  // Every task keeps its own entry. "Apply" tasks move at once, each in its
  // own chain; "request" tasks wait together in the one request modal.
  if (!tasks.some((task) => canWorkOnTask(task.userId))) return <>{children}</>;
  if (
    tasks.every((task) => moveOf(task.statusChange) === "deny") ||
    tasks.some((task) => isStatusLocked(entries[task.id]))
  )
    return <>{disabledTrigger(children)}</>;

  const current = shown.every((status) => status === shown[0])
    ? shown[0]
    : undefined;

  const changeStatus = async (status: string) => {
    setOpen(false);
    try {
      await Promise.all(
        tasks.map((task) =>
          updateTaskStatus({
            ...task,
            status,
            isFinal: columns.find((column) => column.slug === status)?.isFinal,
          }),
        ),
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("tasks:popover.status.updateError"),
      );
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen} modal={false}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-60 p-0" align="start">
        <OptionMenu
          label={t("tasks:status.label")}
          placeholder={t("tasks:bulk.statusPlaceholder")}
          options={statusMenuOptions(columns, current)}
          onSelect={changeStatus}
        />
      </PopoverContent>
    </Popover>
  );
}
