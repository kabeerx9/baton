import { useTranslation } from "react-i18next";
import type { Blocker } from "@/components/board/model";
import { NODE_BASE } from "./state-style";

/** A task from another feature that holds one of ours up, or waits on one. Dashed: not ours. */
export function OutsideNode({ item }: { item: Blocker }) {
  const { t } = useTranslation();
  return (
    <li
      data-node={item.key}
      title={t("tasks:hero.feature.lanes.elsewhere", {
        key: item.key,
        title: item.title,
      })}
      className={`${NODE_BASE} border-dashed border-amber-500/70 px-2 text-[10px]`}
    >
      <span>{item.key}</span>
      <span className="truncate font-sans text-xs">{item.title}</span>
      {item.assigneeName && (
        <span className="shrink-0 font-sans text-muted-foreground text-xs">
          {item.assigneeName}
        </span>
      )}
    </li>
  );
}
