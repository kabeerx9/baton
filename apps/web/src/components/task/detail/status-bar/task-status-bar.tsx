import { useUpdateTaskStatus } from "@/hooks/mutations/task/use-update-task-status";
import { useGetColumns } from "@/hooks/queries/column/use-get-columns";
import { toast } from "@/lib/toast";
import { useTranslation } from "react-i18next";
import type Task from "@/types/task";
import { deriveStatusBar } from "./status-bar-model";
import { StatusBarView } from "./status-bar-view";

/**
 * The task's status bar on real data. A write goes through the one status
 * mutation: the server applies it or opens a change request (BOARD.md,
 * "Who can change a task"). Nothing is changed locally, so a request leaves
 * the bar on the current step and the existing toast and banner say so.
 */
export function TaskStatusBar({
  task,
  blocked,
}: {
  task: Task;
  blocked: boolean;
}) {
  const { t } = useTranslation();
  const columns = useGetColumns(task.projectId);
  const update = useUpdateTaskStatus();
  const state = deriveStatusBar({
    columns: columns.data,
    status: task.status,
    blocked,
    loading: columns.isLoading,
    failed: columns.isError,
  });

  const choose = async (slug: string) => {
    if (state.kind === "ready" && slug === state.current) return;
    try {
      await update.mutateAsync({ ...task, status: slug });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("tasks:popover.status.updateError"),
      );
    }
  };

  return (
    <StatusBarView state={state} pending={update.isPending} onChoose={choose} />
  );
}
