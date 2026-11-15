import type { TFunction } from "i18next";
import type { Headline } from "./focus-plan";

/** The one sentence at the top of the page. */
export function headlineText(t: TFunction, headline: Headline): string {
  switch (headline.kind) {
    case "waiting":
      return t("workspace:myTasks.headline.waiting", { count: headline.count });
    case "overdue":
      return t("workspace:myTasks.headline.overdue", { count: headline.count });
    case "today":
      return t("workspace:myTasks.headline.today", { count: headline.count });
    case "nothingDue":
      return t("workspace:myTasks.headline.nothingDue");
    case "heldOnly":
      return t("workspace:myTasks.headline.heldOnly");
    default:
      return t("workspace:myTasks.headline.clear");
  }
}
