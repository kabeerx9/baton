import { useTranslation } from "react-i18next";
import type { Blockable } from "./model";
import { waitingNote } from "./waiting-note";

/** "Waiting on KEY · Name", for any item an open task holds up. Hidden blockers are counted only. */
export function WaitingChip({ item }: { item: Blockable }) {
  const { t } = useTranslation();
  const note = waitingNote(item);
  if (!note) return null;
  return (
    <div className="mt-3 flex items-start gap-1.5 rounded-md bg-amber-500/10 px-2 py-1 text-[11.5px] text-amber-700 dark:text-amber-400">
      <span className="mt-1 size-1.5 shrink-0 rounded-full bg-amber-500" />
      <span className="flex min-w-0 flex-col">
        {note.visible.length > 0 && (
          <span className="truncate">
            {t("workspace:board.waiting.on", {
              list: note.visible.join(", "),
            })}
          </span>
        )}
        {note.hidden > 0 && (
          <span className="truncate">
            {t("workspace:board.waiting.hidden", { count: note.hidden })}
          </span>
        )}
      </span>
    </div>
  );
}
