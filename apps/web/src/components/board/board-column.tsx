import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { orderCards } from "./card-order";
import { splitDone } from "./done-window";
import type { BoardTask, Lane, Status } from "./model";
import { StatusIcon } from "./status-icon";
import { TaskCard } from "./task-card";

/** One board column. Done shows only recent work and links to History for the rest. */
export function BoardColumn({
  status,
  today,
  items: all,
  lanes,
  workspaceId,
  justCreated,
  onHighlightDone,
}: {
  status: Status;
  /** Start of the local day, ms. Shared by the whole board. */
  today: number;
  items: BoardTask[];
  lanes: Lane[];
  workspaceId: string;
  justCreated: string | null;
  onHighlightDone: () => void;
}) {
  const { t } = useTranslation();
  // Done keeps 14 calendar days counted from local midnight (accepted policy).
  const { recent, olderCount } =
    status === "done"
      ? splitDone(all, new Date(today))
      : { recent: all, olderCount: 0 };
  const items = orderCards(
    recent,
    (f) => ({
      key: f.key,
      priority: f.priority,
      dueDate: f.dueDate,
      done: f.column === "done",
    }),
    today,
  );
  return (
    <div className="flex min-w-0 flex-col gap-3 rounded-xl bg-muted/40 p-2.5">
      <div className="flex items-center gap-2 px-1 text-xs">
        <StatusIcon status={status} size={13} />
        <span className="font-medium">
          {t(`workspace:board.columns.${status}`)}
        </span>
        <span className="tabular-nums text-muted-foreground">
          {items.length}
        </span>
      </div>
      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-6 text-center text-xs text-muted-foreground">
          {t("workspace:board.empty")}
        </div>
      ) : (
        items.map((f) => (
          <TaskCard
            key={f.id}
            boardTask={f}
            highlighted={f.id === justCreated}
            onHighlightDone={onHighlightDone}
            lanes={lanes}
            today={today}
            workspaceId={workspaceId}
          />
        ))
      )}
      {olderCount > 0 && (
        <p className="px-1 text-center text-xs text-muted-foreground">
          {t("workspace:board.done.older", { count: olderCount })} ·{" "}
          <Link
            to="/dashboard/workspace/$workspaceId/history"
            params={{ workspaceId }}
            className="rounded underline underline-offset-2 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t("workspace:board.done.seeHistory")}
          </Link>
        </p>
      )}
    </div>
  );
}
