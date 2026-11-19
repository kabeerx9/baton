import type { TFunction } from "i18next";
import { describePending } from "@/components/task/change-request/describe-pending";
import { getStatusDisplayLabel } from "@/lib/i18n/domain";
import type { Held } from "./feature-status";

/**
 * What a held task says, in words. `label` is the reason; `note` says who must
 * act.
 */
export function heldCopy(
  t: TFunction,
  held: Held,
): { label: string; note: string } {
  if (held.kind === "asked") {
    return {
      label: describePending(t, held.request, held.requester, (slug) =>
        getStatusDisplayLabel(slug, undefined),
      ),
      note: t("tasks:hero.feature.held.answers", {
        name: held.task.assignee?.name ?? t("tasks:hero.feature.held.theOwner"),
      }),
    };
  }
  const waits = held.task.waitsOn;
  if (waits.length === 0)
    return {
      label: t("tasks:hero.feature.held.waitsOnHidden"),
      note: t("tasks:hero.feature.held.hiddenNote"),
    };
  const keys = waits.map((b) => b.key).join(", ");
  const owners = [
    ...new Set(waits.map((b) => b.assigneeName).filter(Boolean)),
  ].join(", ");
  return {
    label:
      held.outside.length > 0
        ? t("tasks:hero.feature.held.waitsOnElsewhere", { keys })
        : t("tasks:hero.feature.held.waitsOn", { keys }),
    note: owners
      ? t("tasks:hero.feature.held.holdsItUp", { names: owners })
      : t("tasks:hero.feature.held.noBlockerOwner"),
  };
}
