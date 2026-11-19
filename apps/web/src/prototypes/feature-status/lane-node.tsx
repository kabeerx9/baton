import { Avatar } from "@/components/board/avatar";
import type { Blocker, Subtask } from "@/components/board/model";
import type { Held } from "./feature-status";
import { heldCopy } from "./held-copy";

const BASE =
  "flex min-w-0 items-center gap-1 rounded-lg border bg-card px-1 py-1 font-mono text-[9px] sm:gap-1.5 sm:px-1.5 sm:text-[10px]";

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
      className={`fs-rise ${BASE} ${border} ${task.status === "done" ? "text-muted-foreground" : ""}`}
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

/** A task from another feature that holds one of ours up. Dashed: not ours. */
export function OutsideNode({ blocker }: { blocker: Blocker }) {
  return (
    <li
      data-node={blocker.key}
      title={`${blocker.key} ${blocker.title}, in another feature`}
      className={`${BASE} border-dashed border-amber-500/70 px-2 text-[10px]`}
    >
      <span>{blocker.key}</span>
      <span className="truncate font-sans text-xs">{blocker.title}</span>
      {blocker.assigneeName && (
        <span className="shrink-0 font-sans text-muted-foreground text-xs">
          {blocker.assigneeName}
        </span>
      )}
    </li>
  );
}
