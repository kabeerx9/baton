import {
  ArrowRightIcon,
  CalendarIcon,
  CheckIcon,
  SkipForwardIcon,
} from "lucide-react";
import { motion } from "motion/react";
import type { Ref } from "react";
import { useTranslation } from "react-i18next";
import { ShortcutKeys } from "@/components/shortcuts/shortcut-keys";
import { Button } from "@/components/ui/button";
import type { AssignedTask } from "@/fetchers/task/get-assigned-tasks";
import { cn } from "@/lib/cn";
import { getPriorityLabel } from "@/lib/i18n/domain";
import { DueText } from "./due-text";
import { finishBlockText } from "./finish-block-text";
import { HeldChip } from "./held-chip";
import { LabelDots } from "./label-dots";
import { PendingMark } from "./pending-mark";
import { PersonAvatar } from "./person-avatar";
import { PriorityMark } from "./priority-mark";
import type { Reason } from "./rank";
import { reasonText, reasonTone } from "./reason-text";
import { EASE } from "./row-motion";
import { StatusMark } from "./status-mark";
import { firstName, taskKey } from "./task-facts";
import { TaskLink } from "./task-link";
import { WhenPopover } from "./when-popover";

/** How the card leaves: done lifts away, skip drops to the back of the deck. */
export type LeaveBy = "done" | "skip" | "swap";

const VARIANTS = {
  enter: { opacity: 0, y: 12, scale: 0.98 },
  shown: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.26, ease: EASE },
  },
  leave: (by: LeaveBy) => {
    if (by === "done") {
      return { opacity: 0, y: -14, transition: { duration: 0.16, ease: EASE } };
    }
    if (by === "skip") {
      return {
        opacity: 0,
        y: 14,
        scale: 0.96,
        transition: { duration: 0.18, ease: EASE },
      };
    }
    return { opacity: 0, transition: { duration: 0.12 } };
  },
};

const TONE = {
  waiting: { dot: "bg-warning", text: "text-warning-foreground" },
  overdue: { dot: "bg-destructive", text: "text-destructive-foreground" },
  plain: { dot: "bg-foreground/30", text: "text-muted-foreground" },
} as const;

/** The one task to do now. It is large on purpose: everything else waits below it. */
export function HeroCard({
  ref,
  task,
  reason,
  day,
  workspaceId,
  repo,
  onDone,
  onSkip,
  onMove,
}: {
  ref?: Ref<HTMLElement>;
  task: AssignedTask;
  reason: Reason | null;
  day: number;
  workspaceId: string;
  /** The repo name to show, or "" while it is not known. */
  repo: string;
  onDone: () => void;
  onSkip: () => void;
  onMove: (date: Date | null) => void;
}) {
  const { t } = useTranslation();
  const blocked = finishBlockText(t, task);
  const tone = TONE[reason ? reasonTone(reason) : "plain"];
  return (
    <motion.section
      animate="shown"
      aria-label={t("workspace:myTasks.hero.label")}
      className="relative z-10 rounded-2xl border bg-card p-6 shadow-sm/5 sm:p-7"
      exit="leave"
      initial="enter"
      ref={ref}
      variants={VARIANTS}
    >
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <span
          aria-hidden="true"
          className={cn("size-1.5 rounded-full", tone.dot)}
        />
        <span className="font-medium text-[11px] text-muted-foreground uppercase tracking-[0.08em]">
          {t("workspace:myTasks.hero.label")}
        </span>
        {reason ? (
          <span className={cn("font-medium text-xs", tone.text)}>
            {reasonText(t, reason)}
          </span>
        ) : null}
      </div>

      <div className="mt-5 flex items-baseline gap-2 text-muted-foreground text-xs">
        <span className="font-medium tabular-nums">{taskKey(task)}</span>
        {repo ? (
          <>
            <span aria-hidden="true">·</span>
            <span>{repo}</span>
          </>
        ) : null}
      </div>
      <h2 className="mt-1.5 max-w-[30ch] text-balance font-semibold text-[28px] leading-[1.12] tracking-tight">
        <TaskLink
          className="rounded-sm outline-none decoration-1 decoration-foreground/25 underline-offset-4 hover:underline focus-visible:underline"
          task={task}
          workspaceId={workspaceId}
        >
          {task.title}
        </TaskLink>
      </h2>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <span className="inline-flex items-center gap-1.5">
          <PriorityMark priority={task.priority} />
          {getPriorityLabel(task.priority ?? "no-priority")}
        </span>
        <StatusMark task={task} />
        <DueText className="text-sm" dueDate={task.dueDate} day={day} />
        <LabelDots labels={task.labels} max={3} />
        <HeldChip task={task} />
        <PendingMark task={task} workspaceId={workspaceId} />
      </div>

      {task.waiting.length > 0 ? (
        <ul className="mt-5 flex flex-col gap-2 rounded-xl bg-warning/8 px-3.5 py-3 text-sm dark:bg-warning/10">
          {task.waiting.map((w) => (
            <li className="flex items-center gap-2.5" key={w.id}>
              <PersonAvatar name={w.assigneeName} size={20} />
              <span className="min-w-0 truncate">
                {w.assigneeName ? (
                  <span className="font-medium">
                    {firstName(w.assigneeName)}{" "}
                  </span>
                ) : null}
                {w.assigneeName ? (
                  <span className="text-muted-foreground">
                    {t("workspace:myTasks.hero.cannotMove")}{" "}
                  </span>
                ) : null}
                <span className="tabular-nums">{w.key}</span>
                {w.assigneeName ? null : (
                  <span className="text-muted-foreground">
                    {" "}
                    {t("workspace:myTasks.hero.cannotMoveYet")}
                  </span>
                )}
                <span className="text-muted-foreground"> · {w.title}</span>
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {blocked?.detail && task.waitsOn.length === 0 ? (
        <p className="mt-4 text-muted-foreground text-sm">{blocked.detail}</p>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <Button disabled={blocked !== null} onClick={onDone} size="lg">
          <CheckIcon />
          {t("workspace:myTasks.hero.done")}
          <ShortcutKeys
            className="ms-1 [&_kbd]:border-primary-foreground/20 [&_kbd]:bg-primary-foreground/10 [&_kbd]:text-primary-foreground"
            id="finishNextTask"
          />
        </Button>
        <Button onClick={onSkip} size="lg" variant="outline">
          <SkipForwardIcon />
          {t("workspace:myTasks.hero.skip")}
          <ShortcutKeys className="ms-1" id="skipNextTask" />
        </Button>
        <WhenPopover
          day={day}
          dueDate={task.dueDate}
          onMove={onMove}
          trigger={<Button size="lg" variant="ghost" />}
        >
          <CalendarIcon />
          {task.dueDate
            ? t("workspace:myTasks.hero.move")
            : t("workspace:myTasks.hero.setDate")}
        </WhenPopover>
        <Button
          className="ms-auto"
          render={<TaskLink task={task} workspaceId={workspaceId} />}
          size="lg"
          variant="ghost"
        >
          {t("workspace:myTasks.hero.open")}
          <ArrowRightIcon />
        </Button>
      </div>
    </motion.section>
  );
}
