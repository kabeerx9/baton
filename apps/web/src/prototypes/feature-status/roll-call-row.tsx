import { Avatar } from "@/components/board/avatar";
import { type Subtask, STATUS_LABEL } from "@/components/board/model";
import { StatusIcon } from "@/components/board/status-icon";
import type { Held } from "./feature-status";
import { heldCopy } from "./held-copy";
import { ASKED_TEXT, BLOCKED_TEXT } from "./state-style";

/** One task: state glyph, key, title, owner, and the reason it is held. */
export function RollCallRow({
  task,
  held,
  index,
}: {
  task: Subtask;
  held?: Held;
  index: number;
}) {
  const copy = held ? heldCopy(held) : null;
  return (
    <li
      className="fs-rise flex items-start gap-3 px-3.5 py-2.5"
      style={{ animationDelay: `${Math.min(index, 8) * 30}ms` }}
    >
      <span className="mt-0.5">
        <StatusIcon
          status={task.status}
          blocked={held?.kind === "blocked"}
          size={16}
        />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-baseline gap-2 text-sm">
          <span className="shrink-0 font-mono text-muted-foreground text-xs">
            {task.key}
          </span>
          <span
            className={`truncate ${task.status === "done" ? "text-muted-foreground" : "font-medium"}`}
          >
            {task.title}
          </span>
        </span>
        {held && copy && (
          <span
            className={`mt-0.5 block text-xs ${held.kind === "blocked" ? BLOCKED_TEXT : ASKED_TEXT}`}
          >
            {copy.label}
            <span className="text-muted-foreground"> · {copy.note}</span>
          </span>
        )}
      </span>
      <span className="flex shrink-0 items-center gap-1.5 text-muted-foreground text-xs">
        {task.status === "review" && (
          <span className="hidden sm:inline">{STATUS_LABEL.review}</span>
        )}
        <Avatar person={task.assignee} size={22} />
        <span className="hidden w-14 truncate sm:inline">
          {task.assignee?.name ?? "Unassigned"}
        </span>
      </span>
    </li>
  );
}
