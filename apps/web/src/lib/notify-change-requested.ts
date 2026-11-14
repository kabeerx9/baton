import type { QueryClient } from "@tanstack/react-query";
import i18n from "i18next";
import { toast } from "@/lib/toast";

type Members = { members?: { id: string; name: string }[] };

/**
 * A change by someone outside the task only opens a request. Say so, and name
 * the assignee when the board already knows them. The task keeps its current
 * value, because the callers change nothing locally.
 */
export function notifyChangeRequested(
  queryClient: QueryClient,
  task?: { userId?: string | null },
) {
  const assigneeId = task?.userId;
  const names = assigneeId
    ? queryClient
        .getQueriesData<Members>({ queryKey: ["task-board"] })
        .flatMap(([, board]) => board?.members ?? [])
        .find((member) => member.id === assigneeId)?.name
    : undefined;
  toast.info(
    names
      ? i18n.t("tasks:changeRequest.requestedTo", { names })
      : i18n.t("tasks:changeRequest.requested"),
  );
}
