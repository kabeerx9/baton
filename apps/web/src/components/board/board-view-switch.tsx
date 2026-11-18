import { useTranslation } from "react-i18next";
import {
  SegmentedControl,
  SegmentedControlItem,
} from "@/components/ui/segmented-control";
import type { BoardView } from "./filter-mine";

const VIEWS: BoardView[] = ["all", "mine"];

/** All tasks | My tasks. The URL owns the choice; this only draws it. */
export function BoardViewSwitch({
  view,
  onChoose,
}: {
  view: BoardView;
  onChoose: (view: BoardView) => void;
}) {
  const { t } = useTranslation();
  return (
    <SegmentedControl
      aria-label={t("workspace:board.view.label")}
      value={view}
      onChoose={(next) => {
        if (next === "all" || next === "mine") onChoose(next);
      }}
      className="w-auto rounded-lg p-0.5"
    >
      {VIEWS.map((value) => (
        <SegmentedControlItem
          key={value}
          value={value}
          className="h-7 flex-none rounded-md px-3 text-xs"
        >
          {t(`workspace:board.view.${value}`)}
        </SegmentedControlItem>
      ))}
    </SegmentedControl>
  );
}
