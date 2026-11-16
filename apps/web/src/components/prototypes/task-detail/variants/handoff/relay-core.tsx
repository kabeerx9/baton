import { CheckIcon } from "lucide-react";
import { motion } from "motion/react";
import { Avatar } from "@/components/board/avatar";
import { STAGE_LABEL } from "../../copy";
import type { TaskView } from "../../derive";
import { type Tone, TONE_CLASS } from "../../tone";
import type { TaskDetail } from "../../types";

const R = 54;
const C = 2 * Math.PI * R;
const PROGRESS = { todo: 0.04, doing: 0.5, review: 0.8, done: 1 } as const;

/** The task itself: a ring that fills with its stage, around its owner. */
export function RelayCore({
  task,
  view,
  tone,
}: {
  task: TaskDetail;
  view: TaskView;
  tone: Tone;
}) {
  const t = TONE_CLASS[tone];
  const status = view.status;
  const progress = status ? PROGRESS[status] : 0;
  const alive = view.state.kind === "active" && status === "doing";
  return (
    <div className="relative flex shrink-0 flex-col items-center gap-3">
      <div
        className={`relative grid size-[148px] place-items-center rounded-full ${t.glow}`}
      >
        {alive && (
          <span
            className={`proto-ping absolute inset-2 rounded-full border-2 ${t.border}`}
            aria-hidden="true"
          />
        )}
        <svg
          viewBox="0 0 128 128"
          className={`absolute inset-0 -rotate-90 ${t.text}`}
          aria-hidden="true"
        >
          <circle
            cx="64"
            cy="64"
            r={R}
            fill="none"
            stroke="currentColor"
            strokeOpacity={0.14}
            strokeWidth={6}
          />
          <motion.circle
            cx="64"
            cy="64"
            r={R}
            fill="none"
            stroke="currentColor"
            strokeWidth={6}
            strokeLinecap="round"
            strokeDasharray={C}
            initial={{ strokeDashoffset: C }}
            animate={{ strokeDashoffset: C * (1 - progress) }}
            transition={{
              duration: 0.7,
              ease: [0.23, 1, 0.32, 1],
              delay: 0.15,
            }}
          />
        </svg>
        <div className="relative grid size-[104px] place-items-center rounded-full bg-card shadow-inner ring-1 ring-border">
          {task.assignee ? (
            <Avatar person={task.assignee} size={64} />
          ) : (
            <span className="grid size-16 place-items-center rounded-full border-2 border-dashed border-muted-foreground/40 text-xs text-muted-foreground">
              Unowned
            </span>
          )}
        </div>
        {status === "done" && (
          <motion.span
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{
              type: "spring",
              stiffness: 420,
              damping: 22,
              delay: 0.5,
            }}
            className="absolute right-3 bottom-3 grid size-8 place-items-center rounded-full bg-emerald-500 text-white ring-4 ring-card"
          >
            <CheckIcon className="size-4" aria-hidden="true" />
          </motion.span>
        )}
      </div>
      <span
        className={`rounded-full px-2.5 py-1 text-xs font-medium ${t.soft}`}
      >
        {status ? STAGE_LABEL[status] : "Unknown"}
      </span>
    </div>
  );
}
