import { useUpdateTaskStatus } from "@/hooks/mutations/task/use-update-task-status";
import { useGetColumns } from "@/hooks/queries/column/use-get-columns";
import { toast } from "@/lib/toast";
import { useTaskStatusStore } from "@/store/task-status/store";
import {
  isStatusLocked,
  moveOf,
  shownStatus,
} from "@/store/task-status/transition";
import { useTranslation } from "react-i18next";
import type Task from "@/types/task";
import { deriveStatusBar } from "./status-bar-model";
import { StatusBarView } from "./status-bar-view";

/**
 * The task's status bar on real data. A write goes through the one status
 * mutation: the server applies it or opens a change request (BOARD.md,
 * "Who can change a task"). A move that applies shows at once, through the
 * task's one status entry; a move that only asks opens the request modal and
 * leaves the bar on the current step.
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
  const entry = useTaskStatusStore((s) => s.entries[task.id]);
  const state = deriveStatusBar({
    columns: columns.data,
    status: shownStatus(task, entry),
    blocked,
    loading: columns.isLoading,
    failed: columns.isError,
  });

  const choose = async (slug: string) => {
    if (state.kind === "ready" && slug === state.current) return;
    try {
      await update.mutateAsync({
        ...task,
        status: slug,
        isFinal: columns.data?.find((column) => column.slug === slug)?.isFinal,
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
    <StatusBarView
      state={state}
      pending={isStatusLocked(entry) || moveOf(task.statusChange) === "deny"}
      onChoose={choose}
    />
  );
}
