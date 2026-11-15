import { AnimatePresence, motion } from "motion/react";
import { EASE } from "./row-motion";

/** A count that rolls into place when it changes. */
export function RollingNumber({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  return (
    <span className={className}>
      <span className="relative inline-flex overflow-hidden tabular-nums">
        <AnimatePresence initial={false} mode="popLayout">
          <motion.span
            animate={{ y: 0, opacity: 1 }}
            className="inline-block"
            exit={{ y: "-55%", opacity: 0, transition: { duration: 0.14 } }}
            initial={{ y: "55%", opacity: 0 }}
            key={value}
            transition={{ duration: 0.24, ease: EASE }}
          >
            {value}
          </motion.span>
        </AnimatePresence>
      </span>
    </span>
  );
}
