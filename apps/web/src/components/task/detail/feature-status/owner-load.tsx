import { useTranslation } from "react-i18next";
import { Avatar } from "@/components/board/avatar";
import type { OwnerLoad } from "./feature-status";

/** Who holds the open work, and how much. */
export function OwnerLoadRow({ owners }: { owners: OwnerLoad[] }) {
  const { t } = useTranslation();
  if (owners.length === 0) return null;
  return (
    <ul
      aria-label={t("tasks:hero.feature.owners.label")}
      className="flex flex-wrap gap-x-4 gap-y-1.5"
    >
      {owners.map((o) => (
        <li
          key={o.person?.id ?? "none"}
          className="flex items-center gap-1.5 text-muted-foreground text-xs"
        >
          <Avatar person={o.person} size={20} />
          <span className="text-foreground">
            {o.person?.name ?? t("tasks:hero.diagram.unassigned")}
          </span>
          <span className="tabular-nums">
            {t("tasks:hero.feature.owners.open", { count: o.open.length })}
          </span>
        </li>
      ))}
    </ul>
  );
}
