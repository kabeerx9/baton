import { motion } from "motion/react";
import { Avatar } from "@/components/board/avatar";
import { headline, STAGE_LABEL, subline } from "../../copy";
import type { PageProps } from "../../page-props";
import { BAND_CLASS, toneOf } from "../../tone";
import { StageStepper } from "./stage-stepper";

const WORD = {
  unknown: "Unknown",
  done: "Done",
  awaiting: "Requested",
  blocked: "Waiting",
  active: "",
} as const;

/** One loud fact: the state, in big type, on a colored band. */
export function StatusBand(props: PageProps) {
  const { task, view } = props;
  const tone = toneOf(view.state);
  const word =
    view.state.kind === "awaiting" && view.status
      ? STAGE_LABEL[view.status]
      : view.state.kind === "active"
        ? view.state.stage === "todo"
          ? "Ready"
          : view.state.stage === "doing"
            ? "In progress"
            : "In review"
        : WORD[view.state.kind];
  const live = view.state.kind === "blocked" || view.state.kind === "awaiting";
  return (
    <section
      aria-label="Status"
      className={`relative isolate overflow-hidden bg-gradient-to-br ${BAND_CLASS[tone]} text-white`}
    >
      <div
        className="proto-dots pointer-events-none absolute inset-0 -z-10 opacity-40 [mask-image:linear-gradient(to_bottom,black,transparent)]"
        aria-hidden="true"
      />
      {live && (
        <div
          className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
          aria-hidden="true"
        >
          <div className="proto-sweep h-full w-1/2 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        </div>
      )}
      <div className="mx-auto max-w-5xl px-4 pt-14 pb-14 sm:px-6 sm:pt-16">
        <div className="flex items-center gap-2 text-xs text-white/80">
          <span className="rounded-md bg-white/15 px-1.5 py-0.5 font-mono text-white">
            {task.key}
          </span>
          {task.repo} · created {task.createdAgo}
        </div>
        <motion.p
          key={word}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
          className="mt-4 text-[44px] leading-none font-bold tracking-tight sm:text-[68px]"
        >
          {word}
        </motion.p>
        <h1 className="mt-4 max-w-3xl text-balance text-xl font-medium text-white/95 sm:text-2xl">
          {task.title}
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-white/80">
          {headline(view.state, task)} {subline(view, task)}
        </p>
        <div className="mt-7 flex flex-wrap items-center justify-between gap-4">
          <StageStepper {...props} />
          <div className="flex -space-x-2" aria-label="People involved">
            {[
              task.creator,
              ...(task.assignee && task.assignee.id !== task.creator.id
                ? [task.assignee]
                : []),
            ].map((p) => (
              <span key={p.id} className="rounded-full ring-2 ring-white/40">
                <Avatar person={p} size={32} />
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
