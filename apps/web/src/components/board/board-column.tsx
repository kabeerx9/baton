import { Link } from "@tanstack/react-router";
import { useId } from "react";
import { useTranslation } from "react-i18next";
import type { BoardView } from "./filter-mine";
import type { BoardTask, Lane, Status } from "./model";
import { StatusIcon } from "./status-icon";
import { TaskCard } from "./task-card";

/** One board column. Done shows only recent work and links to History for the rest. */
export function BoardColumn({
  status,
  view,
  today,
  items,
  olderCount,
  lanes,
  workspaceId,
  justCreated,
  onHighlightDone,
}: {
  status: Status;
  view: BoardView;
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
      className="flex min-h-0 min-w-0 flex-col gap-3 rounded-xl bg-muted/40 p-2.5"
    >
      <div className="flex shrink-0 items-center gap-2 px-1 text-xs">
        <StatusIcon status={status} size={13} />
        <h2 id={titleId} className="font-medium">
          {t(`workspace:board.columns.${status}`)}
        </h2>
        <span className="tabular-nums text-muted-foreground">
          {items.length}
        </span>
      </div>
      {/* Side by side (lg and up) the list scrolls here and the header stays.
          On a phone the page scrolls. The padding keeps focus rings unclipped. */}
      <div
        // Focus brings the whole card into view, not only its link.
        onFocus={(event) =>
          event.target.closest("article")?.scrollIntoView({ block: "nearest" })
        }
        className="relative -mx-1 flex min-h-0 flex-col gap-3 px-1 lg:flex-1 lg:overflow-y-auto lg:overscroll-contain"
      >
        {items.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border py-6 text-center text-xs text-muted-foreground">
            {t(
              view === "mine"
                ? "workspace:board.emptyMine"
                : "workspace:board.empty",
            )}
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
      </div>
    </section>
  );
}
