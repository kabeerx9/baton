import type { TFunction } from "i18next";
import { formatNames } from "./format-names";
import type { Reason } from "./rank";

/** How strongly a reason should read. */
export type ReasonTone = "waiting" | "overdue" | "plain";

export function reasonTone(reason: Reason): ReasonTone {
  if (reason.kind === "people" || reason.kind === "tasks") return "waiting";
  return reason.kind === "overdue" ? "overdue" : "plain";
}

/** Why the next task is first, in a few words. */
export function reasonText(t: TFunction, reason: Reason): string {
  switch (reason.kind) {
    case "people":
      return t("workspace:myTasks.reason.people", {
        count: reason.names.length,
        names: formatNames(reason.names),
      });
    case "tasks":
      return t("workspace:myTasks.reason.tasks", { count: reason.count });
    case "overdue":
      return t("workspace:myTasks.reason.overdue", { count: reason.days });
    case "today":
      return t("workspace:myTasks.reason.today");
    case "priority":
      return t("workspace:myTasks.reason.priority");
    case "picked":
      return t("workspace:myTasks.reason.picked");
    default:
      return t("workspace:myTasks.reason.next");
  }
}
