import { Plus } from "lucide-react";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { useLocalDay } from "@/hooks/use-local-day";
import { BoardViewSwitch } from "./board-view-switch";
import { BoardColumn } from "./board-column";
import { COLUMNS, columnOrder } from "./column-order";
import { BoardNavRoot, useBoardNav } from "./keyboard/use-board-nav";
import { recoveryText } from "./keyboard/recovery-text";
import { applyView, type BoardView } from "./filter-mine";
import type { BoardTask, Lane } from "./model";
import { NewTaskDialog } from "./new-task-dialog";

export function TaskBoard({
  boardTasks,
  lanes,
  workspaceId,
  olderDoneCount,
  view,
  onViewChange,
  userId,
}: {
  boardTasks: BoardTask[];
  lanes: Lane[];
  workspaceId: string;
  /** Done cards the server left out of the window. */
  olderDoneCount: number;
  /** The URL's choice. */
  view: BoardView;
  onViewChange: (view: BoardView) => void;
  /** The signed-in user, for My tasks. */
  userId: string | undefined;
}) {
  // One clock for the whole board: ticks at local midnight and on focus.
  const today = useLocalDay();
  const { t } = useTranslation();
  const shown = applyView(view, boardTasks, userId);
  // The older-done count is workspace-wide: it would mislead in My tasks.
  const columns = columnOrder(
    shown,
    today,
    view === "mine" ? 0 : olderDoneCount,
  );
  const nav = useBoardNav({
    columns: COLUMNS,
    order: columns
      .map((column) => column.items.map((task) => task.id).join(","))
      .join("|"),
    describe: (details) =>
      recoveryText(details, (key, values) => t(key, values)),
  });
  const [creating, setCreating] = useState(false);
  const [justCreated, setJustCreated] = useState<string | null>(null);
  const clearJustCreated = useCallback(() => setJustCreated(null), []);
  const features = shown.filter((t) => t.subtasks.length > 0).length;
  const single = shown.length - features;
  return (
    <div
      data-tour="board"
      className="mx-auto flex w-full max-w-6xl flex-col px-4 py-4 sm:px-6 sm:py-6 lg:h-full lg:min-h-0"
    >
      <div className="mb-4 flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 sm:mb-5">
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground tabular-nums">
            {features}
          </span>{" "}
          {features === 1 ? "feature" : "features"} ·{" "}
          <span className="font-medium text-foreground tabular-nums">
            {single}
          </span>{" "}
          {single === 1 ? "task" : "tasks"}
        </p>
        <BoardViewSwitch view={view} onChoose={onViewChange} />
        <Button className="ml-auto" size="sm" onClick={() => setCreating(true)}>
          <Plus className="size-4" />
          New task
        </Button>
      </div>
      <BoardNavRoot
        nav={nav}
        aria-label={t("workspace:board.nav.label")}
        data-tour="board-columns"
        className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:min-h-0 lg:flex-1 lg:grid-rows-2 xl:grid-cols-4 xl:grid-rows-1"
      >
        {columns.map(({ status, items, olderCount }) => (
          <BoardColumn
            key={status}
            status={status}
            view={view}
            today={today}
            items={items}
            olderCount={olderCount}
            lanes={lanes}
            workspaceId={workspaceId}
            justCreated={justCreated}
            onHighlightDone={clearJustCreated}
          />
        ))}
      </BoardNavRoot>
      <NewTaskDialog
        workspaceId={workspaceId}
        open={creating}
        onOpenChange={setCreating}
        onCreated={(task) => setJustCreated(task.id)}
      />
    </div>
  );
}
