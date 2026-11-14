import { Plus } from "lucide-react";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { useLocalDay } from "@/hooks/use-local-day";
import { BoardColumn } from "./board-column";
import type { BoardTask, Lane, Status } from "./model";
import { NewTaskDialog } from "./new-task-dialog";

const COLUMNS: Status[] = ["todo", "doing", "review", "done"];

export function TaskBoard({
  boardTasks,
  lanes,
  workspaceId,
}: {
  boardTasks: BoardTask[];
  lanes: Lane[];
  workspaceId: string;
}) {
  // One clock for the whole board: ticks at local midnight and on focus.
  const today = useLocalDay();
  const [creating, setCreating] = useState(false);
  const [justCreated, setJustCreated] = useState<string | null>(null);
  const clearJustCreated = useCallback(() => setJustCreated(null), []);
  const features = boardTasks.filter((t) => t.subtasks.length > 0).length;
  const single = boardTasks.length - features;
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-4 sm:px-6 sm:py-6">
      <div className="mb-4 flex items-center gap-3 sm:mb-5">
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
        <Button className="ml-auto" size="sm" onClick={() => setCreating(true)}>
          <Plus className="size-4" />
          New task
        </Button>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map((status) => (
          <BoardColumn
            key={status}
            status={status}
            today={today}
            items={boardTasks.filter((f) => f.column === status)}
            lanes={lanes}
            workspaceId={workspaceId}
            justCreated={justCreated}
            onHighlightDone={clearJustCreated}
          />
        ))}
      </div>
      <NewTaskDialog
        workspaceId={workspaceId}
        open={creating}
        onOpenChange={setCreating}
        onCreated={(task) => setJustCreated(task.id)}
      />
    </div>
  );
}
