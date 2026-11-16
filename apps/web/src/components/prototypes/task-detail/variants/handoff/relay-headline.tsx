import { motion } from "motion/react";
import { copyKey } from "../../copy-key";
import { headline, subline } from "../../copy";
import type { PageProps } from "../../page-props";
import { type Tone, TONE_CLASS } from "../../tone";

/** Key, title, then one sentence that says where the task stands. */
export function RelayHeadline({
  task,
  view,
  tone,
}: PageProps & { tone: Tone }) {
  const t = TONE_CLASS[tone];
  return (
    <header>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-foreground">
          {task.key}
        </span>
        <span>{task.repo}</span>
        <span aria-hidden="true">·</span>
        <span>created {task.createdAgo}</span>
        <button
          type="button"
          onClick={() => copyKey(task.key)}
          className="ml-auto rounded-md px-1.5 py-0.5 transition-colors duration-150 hover:bg-accent active:scale-[0.97]"
        >
          Copy key
        </button>
      </div>
      <h1 className="mt-3 max-w-3xl text-balance text-[28px] leading-[1.15] font-semibold tracking-tight sm:text-4xl">
        {task.title}
      </h1>
      <motion.p
        key={view.state.kind + (view.status ?? "")}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
        className="mt-4 flex flex-wrap items-baseline gap-x-2 gap-y-1"
      >
        <span className="inline-flex items-center gap-2">
          <span
            className={`size-2 rounded-full ${t.dot} ${view.state.kind === "blocked" ? "proto-breathe" : ""}`}
            aria-hidden="true"
          />
          <span className={`text-lg font-semibold ${t.text}`}>
            {headline(view.state, task)}
          </span>
        </span>
        <span className="text-sm text-muted-foreground">
          {subline(view, task)}
        </span>
      </motion.p>
    </header>
  );
}
