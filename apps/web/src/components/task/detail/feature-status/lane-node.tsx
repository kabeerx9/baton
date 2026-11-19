import { useTranslation } from "react-i18next";
import { Avatar } from "@/components/board/avatar";
import type { Subtask } from "@/components/board/model";
import { columnOf, type Held } from "./feature-status";
import { heldCopy } from "./held-copy";
import { NODE_BASE } from "./state-style";

/**
 * A task as a small node: owner, key, and on wider screens the title. The
 * arrows are decoration; a held node says its reason in text.
 */
export function LaneNode({
  task,
  held,
  index,
}: {
  task: Subtask;
  held?: Held;
  index: number;
}) {
  const { t } = useTranslation();
  const border =
    held?.kind === "blocked"
      ? "border-amber-500/70"
      : held?.kind === "asked"
        ? "border-violet-500/70"
        : "border-border";
  const copy = held ? heldCopy(t, held) : null;
  return (
    <li
      data-node={task.key}
      title={`${task.key} ${task.title}${copy ? `. ${copy.label}. ${copy.note}.` : ""}`}
      className={`fs-fade ${NODE_BASE} ${border} ${columnOf(task) === "done" ? "text-muted-foreground" : ""}`}
      style={{ animationDelay: `${index * 30}ms` }}
    >
      <Avatar person={task.assignee} size={14} />
      <span className="shrink-0">{task.key}</span>
      <span className="hidden truncate font-sans text-xs sm:inline">
        {task.title}
      </span>
      {copy && (
        <span className="sr-only">
          {copy.label}. {copy.note}.
        </span>
      )}
    </li>
  );
}
