import {
  Check,
  Circle,
  CircleDashed,
  Lock,
  MoreHorizontal,
} from "lucide-react";
import { cn } from "@/lib/cn";

export type DemoStatus = "todo" | "in_progress" | "in_review" | "done";

export type DemoTask = {
  key: string;
  id: string;
  title: string;
  status: DemoStatus;
  waitsOn?: string;
};

export const INITIAL_TASKS: DemoTask[] = [
  {
    key: "design-review",
    id: "DEMO-1",
    title: "Review the onboarding design",
    status: "in_review",
  },
  {
    key: "api-endpoint",
    id: "DEMO-2",
    title: "Build the API endpoint",
    status: "in_progress",
  },
  {
    key: "write-tests",
    id: "DEMO-3",
    title: "Write tests",
    status: "todo",
    waitsOn: "api-endpoint",
  },
  {
    key: "ship-release",
    id: "DEMO-4",
    title: "Ship the release",
    status: "todo",
    waitsOn: "write-tests",
  },
  {
    key: "mcp-hello",
    id: "DEMO-5",
    title: "Say hello from your agent",
    status: "todo",
  },
];

const COLUMNS: { status: DemoStatus; label: string }[] = [
  { status: "todo", label: "To do" },
  { status: "in_progress", label: "In progress" },
  { status: "in_review", label: "In review" },
  { status: "done", label: "Done" },
];

function isBlocked(task: DemoTask, tasks: DemoTask[]) {
  if (!task.waitsOn) return false;
  return tasks.find((t) => t.key === task.waitsOn)?.status !== "done";
}

function Card({
  task,
  tasks,
  onMove,
}: {
  task: DemoTask;
  tasks: DemoTask[];
  onMove: (key: string) => void;
}) {
  const blocked = isBlocked(task, tasks);
  const done = task.status === "done";
  return (
    <div
      data-tour={task.key}
      className={cn(
        "group rounded-lg border border-board-card-border bg-board-card p-3 text-sm shadow-xs/5 transition-colors",
        done && "bg-board-card-done border-board-card-done-border",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            "font-mono text-xs text-board-id",
            done && "text-board-id-done",
          )}
        >
          {task.id}
        </span>
        <span className="rounded-full border px-1.5 py-px text-[10px] font-medium text-muted-foreground">
          Demo
        </span>
      </div>
      <p
        className={cn(
          "mt-1.5 font-medium text-board-title",
          done && "text-board-title-done line-through decoration-1",
        )}
      >
        {task.title}
      </p>
      <div className="mt-2.5 flex items-center justify-between">
        {blocked ? (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Lock className="size-3" /> Waits on{" "}
            {tasks.find((t) => t.key === task.waitsOn)?.id}
          </span>
        ) : task.waitsOn && !done ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-success-foreground">
            <CircleDashed className="size-3" /> Ready to start
          </span>
        ) : (
          <span />
        )}
        {task.key === "api-endpoint" && !done ? (
          <button
            type="button"
            onClick={() => onMove(task.key)}
            className="inline-flex h-6 items-center gap-1 rounded-md border bg-popover px-2 text-xs font-medium hover:bg-accent/50"
          >
            <Check className="size-3" /> Mark done
          </button>
        ) : (
          <MoreHorizontal
            className="size-4 text-muted-foreground opacity-60"
            aria-hidden
          />
        )}
      </div>
    </div>
  );
}

export function MockBoard({
  tasks,
  showTasks,
  onMove,
}: {
  tasks: DemoTask[];
  showTasks: boolean;
  onMove: (key: string) => void;
}) {
  return (
    <div className="flex h-full min-w-0 flex-1 flex-col">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
        <span className="size-5 rounded-md bg-primary" aria-hidden />
        <h1 className="font-heading text-sm font-semibold">Demo workspace</h1>
        <span className="text-xs text-muted-foreground">Board</span>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div
          data-tour="board"
          className="rounded-xl border bg-board-lane/40 p-3"
        >
          <div
            data-tour="tasks"
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
          >
            {COLUMNS.map((col) => {
              const items = showTasks
                ? tasks.filter((t) => t.status === col.status)
                : [];
              return (
                <section
                  key={col.status}
                  aria-label={col.label}
                  className="min-w-0 rounded-lg bg-board-lane p-2"
                >
                  <h2 className="mb-2 flex items-center gap-1.5 px-1 text-xs font-medium text-muted-foreground">
                    <Circle className="size-3" /> {col.label}
                    <span className="tabular-nums">{items.length}</span>
                  </h2>
                  <div className="flex min-h-16 flex-col gap-2">
                    {items.map((t) => (
                      <Card
                        key={t.key}
                        task={t}
                        tasks={tasks}
                        onMove={onMove}
                      />
                    ))}
                    {items.length === 0 && (
                      <p className="px-1 py-3 text-xs text-muted-foreground/70">
                        {showTasks ? "Nothing here" : "No tasks yet"}
                      </p>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
