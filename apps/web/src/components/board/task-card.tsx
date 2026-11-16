import { Link } from "@tanstack/react-router";
import { ChevronDown } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { PendingIndicator } from "@/components/task/change-request/pending-indicator";
import { useBoardMemberName } from "@/hooks/queries/board/use-board-member-name";
import { DueDateLabel } from "@/components/my-work/due-date-text";
import { cn } from "@/lib/cn";
import { Avatar } from "./avatar";
import { CardTree } from "./card-tree";
import { BoardNav } from "./keyboard/board-nav-parts";
import { LaneBars } from "./lane-bars";
import {
  type BoardTask,
  hiddenBlockerCount,
  isBlocked,
  type Lane,
  pendingOn,
  STATUS_LABEL,
  waitingOn,
} from "./model";
import { PriorityMark } from "./priority-mark";
import { StatusMenu } from "./status-menu";
import { WaitingChip } from "./waiting-chip";

const EASE = [0.23, 1, 0.32, 1] as const;
const HIGHLIGHT_MS = 2200;

export function TaskCard({
  boardTask,
  index,
  count,
  highlighted,
  onHighlightDone,
  lanes,
  today,
  workspaceId,
}: {
  boardTask: BoardTask;
  /** Position in its column, from 0, and the column's card count. */
  index: number;
  count: number;
  highlighted: boolean;
  onHighlightDone: () => void;
  lanes: Lane[];
  today: number;
  workspaceId: string;
}) {
  const [peek, setPeek] = useState(false);
  const { t } = useTranslation();
  const reduce = useReducedMotion();
  const nameOf = useBoardMemberName(workspaceId);
  const pending = pendingOn(boardTask);
  const card = useRef<HTMLElement>(null);
  // A new card is scrolled into view and marked for a moment. The timer starts
  // when the card exists, so a slow refetch does not use it up.
  useEffect(() => {
    if (!highlighted) return;
    card.current?.scrollIntoView({
      block: "nearest",
      behavior: reduce ? "auto" : "smooth",
    });
    const timer = window.setTimeout(onHighlightDone, HIGHLIGHT_MS);
    return () => window.clearTimeout(timer);
  }, [highlighted, onHighlightDone, reduce]);
  // No subtasks: the task is one task, done by its own assignee.
  const standalone = boardTask.subtasks.length === 0;
  const people = standalone
    ? [boardTask.assignee]
    : [
        ...new Map(
          // The task's own owner first, then everyone on its subtasks.
          [boardTask, ...boardTask.subtasks].flatMap((t) =>
            t.assignee ? [[t.assignee.id, t.assignee] as const] : [],
          ),
        ).values(),
      ];

  return (
    <BoardNav.Frame
      ref={card}
      value={boardTask.id}
      column={boardTask.column}
      index={index}
      label={boardTask.key}
      data-highlighted={highlighted || undefined}
      data-tour="task-card"
      data-tour-task={boardTask.id}
      className={cn(
        "group rounded-xl border border-border bg-card shadow-[0_1px_2px_rgb(0_0_0/0.04)] transition-[border-color,box-shadow,opacity,filter] duration-150 ease-out motion-reduce:transition-none hover:border-foreground/15 hover:shadow-[0_4px_12px_rgb(0_0_0/0.06)] data-highlighted:border-primary data-highlighted:ring-2 data-highlighted:ring-primary/40",
        // Done work recedes so open work stands out, and returns to full colour
        // while the user hovers, focuses inside, or the card is highlighted.
        boardTask.column === "done" &&
          "opacity-55 grayscale-35 hover:opacity-100 hover:grayscale-0 focus-within:opacity-100 focus-within:grayscale-0 data-highlighted:opacity-100 data-highlighted:grayscale-0",
      )}
    >
      {/* Only the card with the board's tab stop has tabbable inner controls:
          Tab visits that card, its controls, then leaves the board. */}
      {({ active }) => {
        const tabIndex = active ? 0 : -1;
        return (
          <>
            <BoardNav.Card
              value={boardTask.id}
              render={
                <Link
                  to="/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId"
                  params={{
                    workspaceId,
                    projectId: boardTask.projectId,
                    taskId: boardTask.id,
                  }}
                />
              }
              className={`block p-3.5 ${standalone ? "" : "pb-2"} outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl active:scale-[0.995] transition-transform duration-150 ease-out`}
            >
              <span className="sr-only">
                {t("workspace:board.nav.position", {
                  column: t(`workspace:board.columns.${boardTask.column}`),
                  index: index + 1,
                  count,
                })}
              </span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] text-muted-foreground">
                  {boardTask.key}
                </span>
                <PriorityMark priority={boardTask.priority} />
                {boardTask.column !== "done" && (
                  <DueDateLabel dueDate={boardTask.dueDate} day={today} />
                )}
                <span className="ml-auto flex -space-x-0.5">
                  {people.map((p) => (
                    <Avatar key={p?.id ?? "none"} person={p} size={20} />
                  ))}
                </span>
              </div>
              <h3 className="mt-1.5 text-sm font-medium leading-snug">
                {boardTask.title}
              </h3>
              {boardTask.subtasks.length > 0 ? (
                <div className="mt-3">
                  <LaneBars boardTask={boardTask} lanes={lanes} />
                </div>
              ) : null}
              {pending && (
                <div className="mt-3">
                  <PendingIndicator
                    request={pending}
                    requesterName={nameOf(pending.requestedBy)}
                  />
                </div>
              )}
              {boardTask.column !== "done" && (
                <WaitingChip
                  item={{
                    waitsOn: waitingOn(boardTask),
                    hiddenBlockers: hiddenBlockerCount(boardTask),
                  }}
                />
              )}
            </BoardNav.Card>
            {standalone && (
              <div className="-mt-1.5 flex items-center gap-1 px-3 pb-3 text-xs text-muted-foreground">
                <StatusMenu
                  taskId={boardTask.id}
                  status={boardTask.status}
                  blocked={isBlocked(boardTask)}
                  size={13}
                  label={STATUS_LABEL[boardTask.status]}
                  tabIndex={tabIndex}
                />
                <span>· {boardTask.assignee?.name ?? "Unassigned"}</span>
              </div>
            )}
            {!standalone && (
              <>
                <button
                  type="button"
                  onClick={() => setPeek((p) => !p)}
                  aria-expanded={peek}
                  tabIndex={tabIndex}
                  className="flex w-full items-center gap-1 px-3.5 pb-2.5 text-[11px] text-muted-foreground hover:text-foreground"
                >
                  <ChevronDown
                    className={`size-3.5 transition-transform duration-200 ease-[var(--ease-out)] ${peek ? "rotate-180" : ""}`}
                  />
                  {peek
                    ? "Hide tasks"
                    : `${boardTask.subtasks.length} ${boardTask.subtasks.length === 1 ? "task" : "tasks"}`}
                </button>
                <AnimatePresence initial={false}>
                  {peek && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.22, ease: EASE }}
                      className="overflow-hidden px-3.5 pb-3"
                    >
                      <CardTree
                        boardTask={boardTask}
                        lanes={lanes}
                        tabIndex={tabIndex}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            )}
          </>
        );
      }}
    </BoardNav.Frame>
  );
}
