import { LockIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Blockable } from "@/components/board/model";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipPopup, TooltipTrigger } from "@/components/ui/tooltip";
import { heldText } from "./held-text";

/** "Waits on DRF-11 +1": this task cannot be finished yet. The tooltip lists what it waits on. */
export function HeldChip({ task }: { task: Blockable }) {
  const { t } = useTranslation();
  const held = heldText(t, task);
  if (!held) return null;
  return (
    <Tooltip>
      <TooltipTrigger
        // The label repeats the text, so the trigger is named everywhere.
        render={
          <Badge aria-label={held.chip} className="gap-1" variant="secondary" />
        }
      >
        <LockIcon aria-hidden="true" />
        {held.chip}
      </TooltipTrigger>
      <TooltipPopup className="whitespace-pre-line">{held.detail}</TooltipPopup>
    </Tooltip>
  );
}
