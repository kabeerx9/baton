import { Check, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toStatus } from "../model";
import { StatusIcon } from "../status-icon";
import { TaskLink } from "./task-link";
import type { WaitsOnRow } from "./waits-on-rows";

export function BlockerRow({
  row,
  taskKey,
  workspaceId,
  onRemove,
}: {
  row: WaitsOnRow;
  taskKey: string;
  workspaceId: string;
  onRemove: (() => void) | null;
}) {
  const { t } = useTranslation();
  // A finished blocker is not a problem any more, so it is muted, never red.
  return (
    <li
      className={`flex items-center gap-2 text-sm ${row.done ? "text-muted-foreground" : ""}`}
    >
      {row.done ? (
        <span className="flex size-[13px] shrink-0 items-center justify-center">
          <Check
            className="size-3.5"
            aria-label={t("workspace:board.waitsOn.done")}
          />
        </span>
      ) : (
        <StatusIcon status={toStatus(row.task)} size={13} />
      )}
      <TaskLink
        task={row.task}
        taskKey={taskKey}
        workspaceId={workspaceId}
        className={
          row.done ? "line-through decoration-muted-foreground/40" : ""
        }
      />
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={t("workspace:board.waitsOn.remove", { key: taskKey })}
          className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="size-3.5" />
        </button>
      )}
    </li>
  );
}
