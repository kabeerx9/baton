import { useTranslation } from "react-i18next";
import { STATUS_LABEL, type Subtask } from "@/components/board/model";
import { COLUMN_ORDER, columnOf, type Held } from "./feature-status";
import { ASKED_DOT, BLOCKED_DOT, COLUMN_FILL } from "./state-style";

/**
 * One segment per task, finished work first. A dot under a segment marks a
 * blocked or asked task, so the column colors still add up to the counts.
 * The list reads as text for a screen reader: key, column, then the signal.
 */
export function SegmentBar({
  tasks,
  held,
}: {
  tasks: Subtask[];
  held: Held[];
}) {
  const { t } = useTranslation();
  const heldBy = new Map(held.map((h) => [h.task.id, h.kind]));
  const ordered = [...tasks].sort(
    (a, b) =>
      COLUMN_ORDER.indexOf(columnOf(b)) - COLUMN_ORDER.indexOf(columnOf(a)),
  );
  return (
    <ol
      aria-label={t("tasks:hero.feature.pulse.barLabel", {
        count: tasks.length,
      })}
      className="flex gap-1"
    >
      {ordered.map((task, i) => {
        const kind = heldBy.get(task.id);
        const column = columnOf(task);
        return (
          <li
            key={task.id}
            title={`${task.key} ${task.title}`}
            className="flex min-w-0 max-w-14 flex-1 flex-col items-center gap-1.5"
          >
            <span
              className={`fs-grow h-3 w-full rounded-full ${COLUMN_FILL[column]}`}
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
              {kind === "blocked"
                ? t("tasks:hero.feature.pulse.segmentBlocked", {
                    key: task.key,
                    status: STATUS_LABEL[column],
                  })
                : kind === "asked"
                  ? t("tasks:hero.feature.pulse.segmentAsked", {
                      key: task.key,
                      status: STATUS_LABEL[column],
                    })
                  : t("tasks:hero.feature.pulse.segment", {
                      key: task.key,
                      status: STATUS_LABEL[column],
                    })}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
