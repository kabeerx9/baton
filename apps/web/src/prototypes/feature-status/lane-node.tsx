import { Avatar } from "@/components/board/avatar";
import type { Subtask } from "@/components/board/model";
import { NODE_BASE } from "./node-style";
import type { Held } from "./feature-status";
import { heldCopy } from "./held-copy";

/** A task as a small node: owner, key, and on wider screens the title. */
export function LaneNode({
  task,
  held,
  index,
}: {
  task: Subtask;
  held?: Held;
  index: number;
}) {
  const border =
    held?.kind === "blocked"
      ? "border-amber-500/70"
      : held?.kind === "asked"
        ? "border-violet-500/70"
        : "border-border";
  const copy = held ? heldCopy(held) : null;
  return (
    <li
      data-node={task.key}
      title={`${task.key} ${task.title}${copy ? `. ${copy.label}. ${copy.note}.` : ""}`}
      className={`fs-fade ${NODE_BASE} ${border} ${task.status === "done" ? "text-muted-foreground" : ""}`}
      style={{ animationDelay: `${index * 30}ms` }}
    >
      <Avatar person={task.assignee} size={14} />
      <span className="shrink-0">{task.key}</span>
      <span className="hidden truncate font-sans text-xs sm:inline">
        {task.title}
      </span>
    </li>
  );
}
