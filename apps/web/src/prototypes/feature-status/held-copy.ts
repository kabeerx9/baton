import { getStatusDisplayLabel } from "@/lib/i18n/domain";
import type { Held } from "./feature-status";
import { nameOf } from "./people";

/**
 * What a held task says, in words. `label` is the reason; `note` says who must
 * act. Prototype copy: the shipped version moves it to `tasks:hero.*` keys.
 */
export function heldCopy(held: Held): { label: string; note: string } {
  if (held.kind === "asked") {
    const to = getStatusDisplayLabel(
      held.request.targetStatus ?? "",
      undefined,
    );
    return {
      label: `${nameOf(held.request.requestedBy)} asked to move it to ${to}`,
      note: `${held.task.assignee?.name ?? "The owner"} answers`,
    };
  }
  const keys = held.task.waitsOn.map((b) => b.key).join(", ");
  const owners = [
    ...new Set(held.task.waitsOn.map((b) => b.assigneeName).filter(Boolean)),
  ].join(", ");
  const elsewhere = held.outside.length > 0 ? " in another feature" : "";
  return {
    label: `Waits on ${keys}${elsewhere}`,
    note: owners ? `${owners} holds it up` : "Nobody owns the blocker",
  };
}
