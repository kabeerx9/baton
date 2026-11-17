import { motion, useReducedMotion } from "motion/react";
import { useTranslation } from "react-i18next";
import { Avatar } from "./avatar";
import { type BoardTask, isBlocked, type Lane, laneOf } from "./model";
import { StatusMenu } from "./status-menu";

const EASE = [0.23, 1, 0.32, 1] as const;

/** A feature's tasks, listed under its card. */
export function CardTree({
  boardTask,
  lanes,
  tabIndex,
}: {
  boardTask: BoardTask;
  lanes: Lane[];
  /** Passed to each task's status button. */
  tabIndex?: number;
}) {
  const reduce = useReducedMotion();
  const { t } = useTranslation();
  return (
    <div className="relative mt-3 pl-3">
      <span
        aria-hidden="true"
        className="absolute top-1 bottom-3 left-[5px] w-px bg-border"
      />
      {boardTask.subtasks.map((task, i) => {
        const blocked = isBlocked(task);
        const lane = laneOf(lanes, task.projectId);
        return (
          <motion.div
            key={task.id}
            initial={reduce ? false : { opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.18, ease: EASE, delay: i * 0.025 }}
            className="relative flex items-center gap-2 py-1.5 pr-1 pl-3 text-[12.5px]"
          >
            <span
              aria-hidden="true"
              className="absolute top-1/2 left-[-7px] h-px w-3 bg-border"
            />
            <span
              className={`size-1.5 shrink-0 rounded-full ${lane?.tone.dot ?? "bg-border"}`}
              title={lane?.name}
            />
            <StatusMenu
              taskId={task.id}
              status={task.status}
              move={task.move}
              title={task.title}
              blocked={blocked}
              size={13}
              tabIndex={tabIndex}
            />
            <span
              className={`min-w-0 flex-1 truncate ${task.status === "done" ? "text-muted-foreground" : ""}`}
            >
              {task.title}
            </span>
            {blocked && (
              <span className="shrink-0 font-mono text-[10.5px] text-amber-600 dark:text-amber-400">
                ⟵{" "}
                {task.waitsOn[0]?.key ??
                  t("workspace:board.waiting.hiddenShort")}
              </span>
            )}
            <Avatar person={task.assignee} size={16} />
          </motion.div>
        );
      })}
    </div>
  );
}
