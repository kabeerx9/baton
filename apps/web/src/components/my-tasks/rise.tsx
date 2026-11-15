import { motion } from "motion/react";
import type { ReactNode } from "react";
import { EASE } from "./row-motion";

/**
 * A block's entrance: a fade with a small rise. `delay` staggers the blocks of
 * the page; it is never used on single rows. With reduced motion only the fade
 * runs, because the page's MotionConfig drops the movement.
 */
export function Rise({
  delay = 0,
  className,
  children,
}: {
  /** Milliseconds. */
  delay?: number;
  className?: string;
  children: ReactNode;
}) {
  return (
    <motion.div
      animate={{ opacity: 1, y: 0 }}
      className={className}
      initial={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.28, ease: EASE, delay: delay / 1000 }}
    >
      {children}
    </motion.div>
  );
}
