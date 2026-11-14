import { useMutation, useQueryClient } from "@tanstack/react-query";
import i18n from "i18next";
import addSubtask, {
  type AddSubtaskRequest,
} from "@/fetchers/board/add-subtask";
import { toast } from "@/lib/toast";
import { linkBlockers } from "./link-blockers";
import { refreshAfterLink } from "./refresh-after-link";

/** Creates the task, then links what it waits on. One operation, so closing the dialog cannot cut it in half. */
export async function addSubtaskWithLinks({
  blockerIds = [],
  ...request
}: AddSubtaskRequest & { blockerIds?: string[] }) {
  const task = await addSubtask(request);
  const links =
    blockerIds.length > 0
      ? await linkBlockers(task.id, blockerIds)
      : { failed: 0, message: null };
  return { task, blockerIds, ...links };
}

export function useAddSubtask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: addSubtaskWithLinks,
    // Mutation-level, so these run even after the dialog has unmounted.
    onSuccess: ({ task, blockerIds, failed, message }) => {
      queryClient.invalidateQueries({ queryKey: ["task-board"] });
      queryClient.invalidateQueries({ queryKey: ["tasks", task.projectId] });
      if (blockerIds.length > 0) {
        refreshAfterLink(queryClient, [task.id, ...blockerIds]);
      }
      if (failed > 0) {
        toast.error(
          i18n.t("workspace:board.addTask.linkError", {
            count: failed,
            defaultValue: "Task added, but some links failed.",
          }),
          message ? { description: message } : undefined,
        );
      }
    },
  });
}
