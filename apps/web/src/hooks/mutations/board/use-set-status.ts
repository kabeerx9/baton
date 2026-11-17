import { useMutation, useQueryClient } from "@tanstack/react-query";
import i18n from "i18next";
import { toast } from "@/lib/toast";
import type { Move } from "@/store/task-status/types";
import { chooseStatus } from "@/store/task-status/write-status";

/**
 * Moves a task or subtask to another status, from anywhere on the board,
 * through the one per-task writer (store/task-status). The card shows the new
 * status at once when `move` is "apply"; a refusal (409 while blocked) returns
 * it to the server value, with the server's message in a toast. A person
 * outside the task confirms a change request first. The board and every
 * other view reload when the chain ends.
 */
export function useSetStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    networkMode: "always",
    mutationFn: ({
      taskId,
      status,
      isFinal,
      move,
      title,
    }: {
      taskId: string;
      status: string;
      /** The target column completes the task. Defaults to "done". */
      isFinal?: boolean;
      /** `statusChange.move` of the item. Left out, the person confirms a request. */
      move?: Move;
      title?: string;
    }) =>
      chooseStatus({
        queryClient,
        taskId,
        target: { status, isFinal: isFinal ?? status === "done" },
        move: move ?? "request",
        title,
      }),
    onError: (error) => {
      toast.error(
        error.message ||
          i18n.t("workspace:board.statusError", {
            defaultValue: "Could not change the status.",
          }),
      );
    },
  });
}
