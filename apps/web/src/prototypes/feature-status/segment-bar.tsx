import type { Subtask } from "@/components/board/model";
import { STATUS_LABEL } from "@/components/board/model";
import { COLUMN_ORDER, type Held } from "./feature-status";
import { ASKED_DOT, BLOCKED_DOT, COLUMN_FILL } from "./state-style";

/**
 * One segment per task, finished work first. A dot under a segment marks a
 * blocked or asked task, so the column colors still add up to the counts.
 */
export function SegmentBar({
  tasks,
  held,
}: {
  tasks: Subtask[];
  held: Held[];
}) {
  const heldBy = new Map(held.map((h) => [h.task.id, h.kind]));
  const ordered = [...tasks].sort(
    (a, b) => COLUMN_ORDER.indexOf(b.status) - COLUMN_ORDER.indexOf(a.status),
  );
  return (
    <ol aria-label={`${tasks.length} tasks by status`} className="flex gap-1">
      {ordered.map((task, i) => {
        const kind = heldBy.get(task.id);
        const note =
          kind === "blocked" ? ", blocked" : kind === "asked" ? ", asked" : "";
        return (
          <li
            key={task.id}
            title={`${task.key} ${task.title}`}
            className="flex min-w-0 max-w-14 flex-1 flex-col items-center gap-1.5"
          >
            <span
              className={`fs-grow h-3 w-full rounded-full ${COLUMN_FILL[task.status]}`}
              style={{ animationDelay: `${i * 24}ms` }}
            />
            <span
              aria-hidden="true"
              className={`size-1.5 rounded-full ${
                kind === "blocked"
                  ? BLOCKED_DOT
                  : kind === "asked"
                    ? ASKED_DOT
                    : "bg-transparent"
              }`}
            />
            <span className="sr-only">
              {task.key}, {STATUS_LABEL[task.status]}
              {note}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
