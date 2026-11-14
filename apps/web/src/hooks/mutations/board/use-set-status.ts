import { useMutation, useQueryClient } from "@tanstack/react-query";
import i18n from "i18next";
import updateTaskStatus from "@/fetchers/task/update-task-status";
import { invalidateMyWork } from "@/lib/invalidate-my-work";
import { notifyChangeRequested } from "@/lib/notify-change-requested";
import { toast } from "@/lib/toast";

/**
 * Moves a task or subtask to another status, from anywhere on the board.
 * Nothing is changed locally, so a refusal (409 while blocked) leaves the
 * shown status as it was; the server's message shows in a toast and the
 * board reloads so every view agrees with the server. A change by someone
 * outside the task opens a request instead; a toast says so.
 */
export function useSetStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, status }: { taskId: string; status: string }) =>
      updateTaskStatus(taskId, { status }),
    onSuccess: (result) => {
      if (result.outcome === "requested")
        notifyChangeRequested(queryClient, result.task);
    },
    onError: (error) => {
      toast.error(
        error.message ||
          i18n.t("workspace:board.statusError", {
            defaultValue: "Could not change the status.",
          }),
      );
    },
    onSettled: (_data, _error, { taskId }) => {
      queryClient.invalidateQueries({ queryKey: ["task-board"] });
      queryClient.invalidateQueries({ queryKey: ["task", taskId] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      invalidateMyWork(queryClient);
    },
  });
}
