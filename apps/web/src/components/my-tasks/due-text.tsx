import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { formatDate, formatDateShort } from "@/lib/format";
import { describeDue } from "./due-info";

const TONE = {
  overdue: "font-medium text-destructive-foreground",
  today: "font-medium text-foreground",
  tomorrow: "text-muted-foreground",
  weekday: "text-muted-foreground",
  date: "text-muted-foreground",
  none: "text-muted-foreground/70",
} as const;

/** A due date as this page says it: "3d overdue", "Today", "Thu", "Dec 4". */
export function DueText({
  dueDate,
  day,
  className,
  hideEmpty = false,
}: {
  dueDate: string | null;
  /** Start of the viewer's local day, ms. */
  day: number;
  className?: string;
  hideEmpty?: boolean;
}) {
  const { t } = useTranslation();
  const due = describeDue(dueDate, day);
  if (hideEmpty && due.kind === "none") return null;
  const text =
    due.kind === "none"
      ? t("workspace:myTasks.due.none")
      : due.kind === "overdue"
        ? t("workspace:myTasks.due.overdue", { count: due.days })
        : due.kind === "today"
          ? t("workspace:myWork.due.today")
          : due.kind === "tomorrow"
            ? t("workspace:myWork.due.tomorrow")
            : due.kind === "weekday"
              ? formatDate(due.date, { weekday: "short" })
              : formatDateShort(due.date);
  return (
    <span className={cn("text-xs tabular-nums", TONE[due.kind], className)}>
      {text}
    </span>
  );
}
