import { Link } from "@tanstack/react-router";
import { ChevronDown } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { DueDateLabel } from "@/components/my-work/due-date-text";
import { Avatar } from "./avatar";
import { CardTree } from "./card-tree";
import { LaneBars } from "./lane-bars";
import {
  type BoardTask,
  hiddenBlockerCount,
  isBlocked,
  type Lane,
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
  highlighted,
  onHighlightDone,
  lanes,
  today,
  workspaceId,
}: {
  boardTask: BoardTask;
  highlighted: boolean;
  onHighlightDone: () => void;
  lanes: Lane[];
  today: number;
  workspaceId: string;
}) {
  const [peek, setPeek] = useState(false);
  const reduce = useReducedMotion();
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
    <article
      ref={card}
      data-highlighted={highlighted || undefined}
      className="group rounded-xl border border-border bg-card shadow-[0_1px_2px_rgb(0_0_0/0.04)] transition-[border-color,box-shadow] duration-150 ease-out hover:border-foreground/15 hover:shadow-[0_4px_12px_rgb(0_0_0/0.06)] data-highlighted:border-primary data-highlighted:ring-2 data-highlighted:ring-primary/40"
    >
      <Link
        to="/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId"
        params={{
          workspaceId,
          projectId: boardTask.projectId,
          taskId: boardTask.id,
        }}
        className={`block p-3.5 ${standalone ? "" : "pb-2"} outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-xl active:scale-[0.995] transition-transform duration-150 ease-out`}
      >
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
        {boardTask.column !== "done" && (
          <WaitingChip
            item={{
              waitsOn: waitingOn(boardTask),
              hiddenBlockers: hiddenBlockerCount(boardTask),
            }}
          />
        )}
      </Link>
      {standalone && (
        <div className="-mt-1.5 flex items-center gap-1 px-3 pb-3 text-xs text-muted-foreground">
          <StatusMenu
            taskId={boardTask.id}
            status={boardTask.status}
            blocked={isBlocked(boardTask)}
            size={13}
            label={STATUS_LABEL[boardTask.status]}
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
                <CardTree boardTask={boardTask} lanes={lanes} />
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </article>
  );
}
