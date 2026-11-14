import { differenceInCalendarDays } from "date-fns";
import { useTranslation } from "react-i18next";
import { useLocalDay } from "@/hooks/use-local-day";
import { cn } from "@/lib/cn";
import { formatDate, formatDateShort } from "@/lib/format";

type DueDateTextProps = {
  dueDate: string | null;
  className?: string;
};

/** Standalone use: owns the local-day clock. */
export function DueDateText(props: DueDateTextProps) {
  return <DueDateLabel {...props} day={useLocalDay()} />;
}

/**
 * The text for a given local day (start of day, ms). A screen with many dates
 * shares one `useLocalDay` and passes it here, so no label runs its own timer.
 */
export function DueDateLabel({
  dueDate,
  day,
  className,
}: DueDateTextProps & { day: number }) {
  const { t } = useTranslation();

  if (!dueDate) return null;

  const days = differenceInCalendarDays(new Date(dueDate), new Date(day));
  const text =
    days === 0
      ? t("workspace:myWork.due.today")
      : days === 1
        ? t("workspace:myWork.due.tomorrow")
        : days > 1 && days <= 6
          ? formatDate(dueDate, { weekday: "long" })
          : formatDateShort(dueDate);

  return (
    <span
      className={cn(
        "text-xs tabular-nums",
        days < 0
          ? "font-medium text-destructive-foreground"
          : days === 0
            ? "font-medium text-foreground"
            : "text-muted-foreground",
        className,
      )}
    >
      {text}
    </span>
  );
}
