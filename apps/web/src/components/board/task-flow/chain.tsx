import { dependentState } from "./page-blocked";
import { Link } from "@tanstack/react-router";
import { motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
import { Avatar } from "../avatar";
import { StatusIcon } from "../status-icon";
import type { LinkedTask } from "./linked";
import "../flow.css";

const EASE = [0.23, 1, 0.32, 1] as const;

function Connector({ active, delay }: { active: boolean; delay: number }) {
  const reduce = useReducedMotion();
  const color = active ? "var(--color-amber-500)" : "var(--color-emerald-500)";
  return (
    <svg
      viewBox="0 0 64 12"
      preserveAspectRatio="none"
      className="hidden h-3 w-16 shrink-0 self-center md:block"
      aria-hidden="true"
    >
      <motion.path
        d="M 0 6 L 64 6"
        stroke={color}
        strokeOpacity={0.35}
        strokeWidth={2}
        initial={reduce ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.35, ease: EASE, delay }}
      />
      {active && !reduce && (
        <path
          d="M 0 6 L 64 6"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeDasharray="3 7"
          className="board-flow"
        />
      )}
    </svg>
  );
}

const DEPENDENT_LABEL = {
  finished: "Finished",
  canContinue: "Can continue now",
  waiting: "Waiting on this",
} as const;

function LinkCard({
  task,
  label,
  blocked,
  workspaceId,
}: {
  task: LinkedTask;
  label: string;
  blocked?: boolean;
  workspaceId: string;
}) {
  return (
    <Link
      to="/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId"
      params={{ workspaceId, projectId: task.projectId, taskId: task.id }}
      className={`block w-full rounded-xl border bg-card p-3 outline-none transition-[border-color,transform] duration-150 ease-out hover:border-foreground/25 focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98] md:w-56 ${
        blocked ? "border-amber-500/40" : "border-border"
      }`}
    >
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-1 line-clamp-2 text-[13px] leading-snug">{task.title}</p>
      <div className="mt-2.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <StatusIcon status={task.status} blocked={blocked} size={12} />
        <span className="font-mono">{task.key}</span>
        <span className="ml-auto inline-flex items-center gap-1">
          <Avatar person={task.owner} size={16} />
          {task.owner?.name ?? "Unassigned"}
        </span>
      </div>
    </Link>
  );
}

/**
 * The dependency chain: what this task needs first, the task itself, and who
 * waits on it. With no links it is the task card alone.
 */
export function Chain({
  waitsOn,
  stillNeeded,
  blocks,
  done,
  workspaceId,
  children,
}: {
  waitsOn: LinkedTask[];
  /** Whether something in `waitsOn` still holds this task up. */
  stillNeeded: boolean;
  blocks: LinkedTask[];
  /** Whether this task is finished: its outgoing lines stop moving. */
  done: boolean;
  workspaceId: string;
  children: ReactNode;
}) {
  const reduce = useReducedMotion();
  return (
    <div className="rounded-2xl border border-border bg-[radial-gradient(circle,var(--border)_1px,transparent_1px)] p-4 [background-size:16px_16px] md:p-6">
      <div className="mx-auto flex flex-col items-stretch gap-3 md:w-max md:max-w-full md:flex-row md:items-center md:gap-0">
        {waitsOn.length > 0 && (
          <>
            <div className="flex flex-col gap-2">
              {waitsOn.map((task) => (
                <LinkCard
                  key={task.id}
                  task={task}
                  label={
                    task.status === "done" ? "Was needed first" : "Needed first"
                  }
                  workspaceId={workspaceId}
                />
              ))}
            </div>
            <Connector active={stillNeeded} delay={0.05} />
          </>
        )}

        <motion.div
          initial={reduce ? false : { opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.25, ease: EASE, delay: 0.1 }}
          className="w-full shrink-0 rounded-2xl border border-foreground/20 bg-card p-4 shadow-[0_8px_30px_rgb(0_0_0/0.12)] md:w-[360px]"
        >
          {children}
        </motion.div>

        {blocks.length > 0 && (
          <>
            <Connector active={!done} delay={0.2} />
            <div className="flex flex-col gap-2">
              {blocks.map((task) => {
                const state = dependentState({
                  thisDone: done,
                  dependentDone: task.status === "done",
                  waiting: task.blocked ?? !done,
                });
                return (
                  <LinkCard
                    key={task.id}
                    task={task}
                    label={DEPENDENT_LABEL[state]}
                    blocked={state === "waiting"}
                    workspaceId={workspaceId}
                  />
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
