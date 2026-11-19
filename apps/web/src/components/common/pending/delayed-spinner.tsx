import { useTranslation } from "react-i18next";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/cn";
import "./pending.css";
import { useDelayedPending } from "./use-delayed-pending";

type DelayedSpinnerProps = {
  pending: boolean;
  className?: string;
};

/**
 * A small spinner for a child that waits on data. The slot is always there, so
 * nothing moves when the spinner appears or leaves; it shows only after 300ms.
 */
export function DelayedSpinner({ pending, className }: DelayedSpinnerProps) {
  const { t } = useTranslation();
  const visible = useDelayedPending(pending);
  return (
    <span className={cn("inline-grid size-6 place-items-center", className)}>
      {visible ? (
        <Spinner
          aria-label={t("common:empty.loading")}
          className="pending-fade-in size-5 text-muted-foreground"
        />
      ) : null}
    </span>
  );
}
