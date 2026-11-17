import { Menu, MenuItem, MenuPopup, MenuTrigger } from "@/components/ui/menu";
import { useSetStatus } from "@/hooks/mutations/board/use-set-status";
import { useTaskStatusStore } from "@/store/task-status/store";
import { isStatusLocked } from "@/store/task-status/transition";
import type { Move } from "@/store/task-status/types";
import { STATUS_LABEL, type Status } from "./model";
import { StatusIcon } from "./status-icon";

// Board status to the column slug every project starts with.
const SLUG: Record<Status, string> = {
  todo: "to-do",
  doing: "in-progress",
  review: "in-review",
  done: "done",
};

const ORDER: Status[] = ["todo", "doing", "review", "done"];

/** The status icon as a button: click it to move the task, without opening it. */
export function StatusMenu({
  taskId,
  status,
  move,
  title,
  blocked,
  size = 14,
  label,
  tabIndex,
}: {
  taskId: string;
  /** The status to show: the board read with writes in flight laid over it. */
  status: Status;
  /** What a column move does for this person (`statusChange.move`). */
  move: Move;
  /** Names the task in the change-request modal. */
  title?: string;
  blocked?: boolean;
  size?: number;
  /** Shown next to the icon when given. */
  label?: string;
  /** -1 takes the trigger out of the tab order (a board card has one tab stop). */
  tabIndex?: number;
}) {
  const setStatus = useSetStatus();
  // The task's one lifecycle, shared with every other control of it.
  const locked = useTaskStatusStore((state) =>
    isStatusLocked(state.entries[taskId]),
  );
  return (
    <Menu>
      <MenuTrigger
        render={
          <button
            type="button"
            data-tour="status-menu"
            aria-label={`Status: ${STATUS_LABEL[status]}. Change status`}
            disabled={locked || move === "deny"}
            tabIndex={tabIndex}
            className="relative inline-flex shrink-0 items-center gap-1.5 rounded-md p-0.5 outline-none transition-colors duration-150 ease-out hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 touch-hitbox"
          />
        }
      >
        <StatusIcon status={status} blocked={blocked} size={size} />
        {label}
      </MenuTrigger>
      <MenuPopup align="start" className="min-w-40">
        {ORDER.map((s) => (
          <MenuItem
            key={s}
            data-tour={s === "done" ? "status-done" : undefined}
            // The API refuses to finish a blocked task; say so here first.
            disabled={s === status || (blocked && s === "done")}
            onClick={() =>
              setStatus.mutate({
                taskId,
                status: SLUG[s],
                isFinal: s === "done",
                move,
                title,
              })
            }
          >
            <StatusIcon status={s} size={13} />
            {STATUS_LABEL[s]}
            {blocked && s === "done" ? " · blocked" : ""}
          </MenuItem>
        ))}
      </MenuPopup>
    </Menu>
  );
}
