import { type BoardTask, type Lane, progress } from "./model";

/** One bar per repo. Solid is done; faint behind it is work that has started. */
export function LaneBars({
  boardTask,
  lanes,
}: {
  boardTask: BoardTask;
  lanes: Lane[];
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {lanes.map((lane) => {
        const tasks = boardTask.subtasks.filter(
          (t) => t.projectId === lane.projectId,
        );
        if (tasks.length === 0) return null;
        const { done, total, ratio, startedRatio } = progress(tasks);
        return (
          <div
            key={lane.projectId}
            className="flex items-center gap-2 text-[11px]"
          >
            <span className={`w-20 truncate ${lane.tone.text}`}>
              {lane.name}
            </span>
            <div className="relative h-1 flex-1 overflow-hidden rounded-full bg-border">
              <div
                className={`absolute inset-0 origin-left rounded-full opacity-35 transition-transform duration-500 ease-[var(--ease-out)] ${lane.tone.bar}`}
                style={{ transform: `scaleX(${startedRatio})` }}
              />
              <div
                className={`absolute inset-0 origin-left rounded-full transition-transform duration-500 ease-[var(--ease-out)] ${lane.tone.bar}`}
                style={{ transform: `scaleX(${ratio})` }}
              />
            </div>
            <span className="w-7 text-right tabular-nums text-muted-foreground">
              {done}/{total}
            </span>
          </div>
        );
      })}
    </div>
  );
}
