import { ClockIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getStatusLabel } from "@/lib/i18n/domain";
import { describePending, type PendingRequest } from "./describe-pending";

/**
 * A small amber marker for a task with a change request waiting, in the same
 * style as the banner. It reads the summary the list already carries, so it
 * costs no request. The tooltip says who asked and for what.
 */
export function PendingIndicator({
  request,
  requesterName,
}: {
  request: PendingRequest;
  requesterName: string | null;
}) {
  const { t } = useTranslation();
  const detail = describePending(t, request, requesterName, getStatusLabel);
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            aria-label={`${t("tasks:changeRequest.pending")}: ${detail}`}
            className="inline-flex shrink-0 items-center gap-1 rounded-md bg-amber-500/10 px-1.5 py-0.5 font-medium text-[11px] text-amber-700 dark:text-amber-400"
            role="img"
          />
        }
      >
        <ClockIcon aria-hidden="true" className="size-3" />
        {t("tasks:changeRequest.pending")}
      </TooltipTrigger>
      {/* The board card is a Link, and a React portal keeps events bubbling
          through the component tree, so container alone does not keep a click
          on the tooltip away from the card. */}
      <TooltipContent
        container={document.body}
        onClick={(event) => event.stopPropagation()}
      >
        {detail}
      </TooltipContent>
    </Tooltip>
  );
}
