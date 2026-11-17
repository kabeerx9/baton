import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "@/components/settings/confirm-dialog";
import { useTaskStatusStore } from "@/store/task-status/store";
import {
  confirmRequests,
  dismissRequests,
} from "@/store/task-status/write-status";

/**
 * The one modal for status moves that only ask. Every control of a task reads
 * and writes the same store entry, so two controls on one task open one modal
 * and send one request, and a bulk move lists all its request tasks here.
 * Mounted once, by the app layout.
 */
export function StatusRequestModal() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const entries = useTaskStatusStore((state) => state.entries);
  const titles = useTaskStatusStore((state) => state.titles);

  const waiting = Object.keys(entries).filter(
    (id) =>
      entries[id]?.kind === "confirming" || entries[id]?.kind === "asking",
  );
  const sending = waiting.some((id) => entries[id]?.kind === "asking");
  const many = waiting.length > 1;

  return (
    <ConfirmDialog
      open={waiting.length > 0}
      // Closing while the request flies would hide the answer: wait for it.
      onOpenChange={(open) => {
        if (!open && !sending) dismissRequests();
      }}
      title={
        many
          ? t("tasks:changeRequest.confirmTitleMany")
          : t("tasks:changeRequest.confirmTitle")
      }
      description={t("tasks:changeRequest.confirmDescription")}
      confirmLabel={t("tasks:changeRequest.confirmSend")}
      pendingLabel={t("tasks:changeRequest.confirmSending")}
      pending={sending}
      destructive={false}
      onConfirm={() => confirmRequests(queryClient)}
    >
      {waiting.length > 0 ? (
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
          {waiting.map((id) => (
            <li key={id}>{titles[id] ?? id}</li>
          ))}
        </ul>
      ) : null}
    </ConfirmDialog>
  );
}
