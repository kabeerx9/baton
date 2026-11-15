import { addDays } from "date-fns";
import type { TFunction } from "i18next";
import { type ReactElement, type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";
import { MonthGrid } from "@/components/common/date-picker/month-grid";
import { Popover, PopoverPopup, PopoverTrigger } from "@/components/ui/popover";
import { formatDate } from "@/lib/format";

const QUICK: { days: number; label: (t: TFunction) => string }[] = [
  { days: 0, label: (t) => t("workspace:myTasks.when.today") },
  { days: 1, label: (t) => t("workspace:myTasks.when.tomorrow") },
  { days: 7, label: (t) => t("workspace:myTasks.when.inAWeek") },
];

/** One popover to move a task: three quick days, a month, or no date at all. */
export function WhenPopover({
  dueDate,
  day,
  onMove,
  trigger,
  children,
}: {
  dueDate: string | null;
  /** Start of the viewer's local day, ms. */
  day: number;
  /** The chosen day, or null to clear the date. */
  onMove: (date: Date | null) => void;
  /** The element that opens the popover. `children` is its content. */
  trigger: ReactElement<Record<string, unknown>>;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const pick = (date: Date | null) => {
    onMove(date);
    setOpen(false);
  };
  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger render={trigger}>{children}</PopoverTrigger>
      <PopoverPopup
        align="start"
        aria-label={t("workspace:myTasks.when.label")}
        className="p-1"
      >
        <div className="flex w-[252px] flex-col">
          <div className="flex flex-col pb-1">
            {QUICK.map(({ days, label }) => {
              const date = addDays(new Date(day), days);
              return (
                <button
                  className="flex h-8 cursor-pointer items-center justify-between rounded-md px-2 text-sm outline-none transition-colors duration-100 hover:bg-accent focus-visible:bg-accent"
                  key={days}
                  onClick={() => pick(date)}
                  type="button"
                >
                  {label(t)}
                  <span className="text-muted-foreground text-xs tabular-nums">
                    {formatDate(date, { weekday: "short", day: "numeric" })}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="border-t pt-1">
            <MonthGrid
              autoFocus={false}
              onSelect={pick}
              value={dueDate ? new Date(dueDate) : null}
            />
          </div>
          {dueDate ? (
            <div className="mt-1 border-t pt-1">
              <button
                className="flex h-8 w-full cursor-pointer items-center rounded-md px-2 text-muted-foreground text-sm outline-none transition-colors duration-100 hover:bg-accent hover:text-foreground focus-visible:bg-accent"
                onClick={() => pick(null)}
                type="button"
              >
                {t("workspace:myTasks.when.clear")}
              </button>
            </div>
          ) : null}
        </div>
      </PopoverPopup>
    </Popover>
  );
}
