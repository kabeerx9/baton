import type { TFunction } from "i18next";

/** The compact summary that board, task and My tasks reads carry. */
export type PendingRequest = {
  id: string;
  kind: string;
  targetStatus: string | null;
  requestedBy: string | null;
  channel: "web" | "agent" | null;
  expiresAt: string;
};

/** "Rohan (agent) asked to move this to Done": who asked, and what. */
export function describePending(
  t: TFunction,
  request: PendingRequest,
  requesterName: string | null,
  statusLabel: (slug: string) => string,
) {
  const base = requesterName ?? t("tasks:changeRequest.someone");
  const name =
    request.channel === "agent"
      ? t("tasks:changeRequest.withAgent", { name: base })
      : base;
  if (request.kind === "delete")
    return t("tasks:changeRequest.pendingDelete", { name });
  if (request.targetStatus === "archived")
    return t("tasks:changeRequest.pendingArchive", { name });
  return t("tasks:changeRequest.pendingStatus", {
    name,
    to: statusLabel(request.targetStatus ?? ""),
  });
}
