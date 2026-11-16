import { motion } from "motion/react";
import type { PageProps } from "../../page-props";
import { DescriptionBlock } from "../../shared/description-block";
import { HandoffLatest } from "./handoff-latest";
import { HandoffProperties } from "./handoff-properties";
import { RelayHero } from "./relay-hero";

/**
 * Handoff. The axis is waiting: the hero draws who holds this task up, the
 * task, and who waits on it. Everything else sits below, quieter.
 */
export function HandoffVariant(props: PageProps) {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 pt-14 pb-10 sm:px-6 sm:pt-16">
      <RelayHero {...props} />
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1], delay: 0.2 }}
        className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]"
      >
        <div className="min-w-0 space-y-10">
          <section aria-label="Brief">
            <h2 className="mb-3 text-sm font-semibold">The brief</h2>
            <DescriptionBlock task={props.task} />
          </section>
          <HandoffLatest {...props} />
        </div>
        <HandoffProperties {...props} />
      </motion.div>
    </main>
  );
}
