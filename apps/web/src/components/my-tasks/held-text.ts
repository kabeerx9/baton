import type { TFunction } from "i18next";
import { type Blockable } from "@/components/board/model";
import { blockedBadge } from "@/components/my-work/blocked-badge";

/** The words for "this task waits on other work": a short chip and the full list. Null when free. */
export function heldText(
  t: TFunction,
  task: Blockable,
): { chip: string; detail: string } | null {
  const badge = blockedBadge(task);
  if (!badge) return null;
  const hidden =
    badge.hidden > 0
      ? t("workspace:myTasks.waitsOnHidden", { count: badge.hidden })
      : null;
  return {
    chip: [
      badge.firstKey
        ? t("workspace:myTasks.waitsOn", { key: badge.firstKey })
        : hidden,
      badge.more > 0
        ? t("workspace:myTasks.waitsOnMore", { count: badge.more })
        : null,
    ]
      .filter(Boolean)
      .join(" "),
    detail: [...badge.titles, hidden].filter(Boolean).join("\n"),
  };
}
