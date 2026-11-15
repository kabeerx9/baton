import { Link } from "@tanstack/react-router";
import { useId } from "react";
import { useTranslation } from "react-i18next";
import type { BoardTask, Lane, Status } from "./model";
import { StatusIcon } from "./status-icon";
import { TaskCard } from "./task-card";

/** One board column. Done shows only recent work and links to History for the rest. */
export function BoardColumn({
  status,
  today,
  items,
  olderCount,
  lanes,
  workspaceId,
  justCreated,
  onHighlightDone,
}: {
  status: Status;
  /** Start of the local day, ms. Shared by the whole board. */
  today: number;
  /** The cards to show, in order (`columnOrder`). */
  items: BoardTask[];
  /** Done only: finished work older than the Done window. */
  olderCount: number;
  lanes: Lane[];
  workspaceId: string;
  justCreated: string | null;
  onHighlightDone: () => void;
}) {
  const { t } = useTranslation();
  const titleId = useId();
  return (
    <section
      aria-labelledby={titleId}
      className="flex min-w-0 flex-col gap-3 rounded-xl bg-muted/40 p-2.5"
    >
      <div className="flex items-center gap-2 px-1 text-xs">
        <StatusIcon status={status} size={13} />
        <h2 id={titleId} className="font-medium">
          {t(`workspace:board.columns.${status}`)}
        </h2>
        <span className="tabular-nums text-muted-foreground">
          {items.length}
        </span>
      </div>
      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-6 text-center text-xs text-muted-foreground">
          {t("workspace:board.empty")}
        </div>
      ) : (
        items.map((f, index) => (
          <TaskCard
            key={f.id}
            boardTask={f}
            index={index}
            count={items.length}
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
    </section>
  );
}
