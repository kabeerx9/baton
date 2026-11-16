import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { AssignedTask } from "@/fetchers/task/get-assigned-tasks";
import { useUpdateTaskDueDate } from "@/hooks/mutations/task/use-update-task-due-date";
import { invalidateMyWork } from "@/lib/invalidate-my-work";
import { toast } from "@/lib/toast";
import { asTaskWrite } from "./as-task-write";
import { patchAssignedDueDate } from "./patch-assigned-due-date";

/**
 * Moves a task to another day, or clears its date with null. The page shows
 * the new date at once. The mutation then reloads the list, and a failure
 * reloads it too, so the server's date always wins.
 */
export function useMoveTask() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { mutateAsync: writeDueDate } = useUpdateTaskDueDate();

  return async (task: AssignedTask, date: Date | null) => {
    const dueDate = date ? date.toISOString() : null;
    // A list fetch already under way would put the old date back.
    await queryClient.cancelQueries({ queryKey: ["assigned-tasks"] });
    patchAssignedDueDate(queryClient, task.id, dueDate);
    try {
      await writeDueDate(asTaskWrite(task, { dueDate }));
    } catch (error) {
      invalidateMyWork(queryClient);
      toast.error(
        (error instanceof Error && error.message) ||
          t("workspace:myTasks.toast.moveError"),
      );
    }
  };
}
