import {
  type Status,
  STATUS_LABEL,
  type Subtask,
} from "@/components/board/model";
import type { Held } from "./feature-status";
import { LaneNode } from "./lane-node";

const LIMIT = 6;

/** One column of the map: the count, the word, then the tasks in it. */
export function LaneColumn({
  status,
  tasks,
  held,
}: {
  status: Status;
  tasks: Subtask[];
  held: Held[];
}) {
  const shown = tasks.slice(0, LIMIT);
  return (
    <section
      aria-label={`${STATUS_LABEL[status]}: ${tasks.length}`}
      className="min-w-0 rounded-xl bg-muted/50 p-1 sm:p-1.5"
    >
      <p className="flex flex-col px-0.5 pb-1.5">
        <span className="font-semibold text-lg tabular-nums leading-tight">
          {tasks.length}
        </span>
        <span className="truncate text-[10px] text-muted-foreground">
          {STATUS_LABEL[status]}
        </span>
      </p>
      <ul className="flex flex-col gap-1.5">
        {shown.map((task, i) => (
          <LaneNode
            key={task.id}
            task={task}
            index={i}
            held={held.find((h) => h.task.id === task.id)}
          />
        ))}
        {tasks.length > shown.length && (
          <li className="px-1 text-[10px] text-muted-foreground">
            +{tasks.length - shown.length} more
          </li>
        )}
      </ul>
    </section>
  );
}
