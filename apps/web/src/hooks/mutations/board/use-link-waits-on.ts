import { useMutation, useQueryClient } from "@tanstack/react-query";
import i18n from "i18next";
import { toast } from "@/lib/toast";
import { linkBlockers } from "./link-blockers";
import { refreshAfterLink } from "./refresh-after-link";

/**
 * Makes a task wait on blockers. The failure toast is a mutation-level
 * callback, so it still shows if the component that started the call is gone.
 */
export function useLinkWaitsOn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      taskId,
      blockerIds,
    }: {
      taskId: string;
      blockerIds: string[];
    }) => linkBlockers(taskId, blockerIds),
    onSuccess: ({ failed, message }) => {
      if (failed > 0) {
        toast.error(
          message ??
            i18n.t("workspace:board.waitsOn.linkError", {
              defaultValue: "Could not link the task.",
            }),
        );
      }
    },
    onSettled: (_result, _error, { taskId, blockerIds }) =>
      refreshAfterLink(queryClient, [taskId, ...blockerIds]),
  });
}
