import i18n from "i18next";
import { toast } from "@/lib/toast";

/**
 * A change by someone outside the task only opens a request. Say so, and name
 * the assignee when there is one. The task keeps its current value, because
 * the callers change nothing locally.
 */
export function notifyChangeRequested(task?: { assigneeName?: string | null }) {
  const names = task?.assigneeName?.trim();
  toast.info(
    names
      ? i18n.t("tasks:changeRequest.requestedTo", { names })
      : i18n.t("tasks:changeRequest.requested"),
  );
}
