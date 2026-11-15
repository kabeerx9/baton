export const EASE = [0.23, 1, 0.32, 1] as const;

/**
 * How a list row enters and leaves. It collapses its height so the rows below
 * slide up; the short delay lets the tick show first. With reduced motion the
 * row only fades.
 */
export function rowMotion(reduced: boolean | null) {
  if (reduced) {
    return {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0, transition: { duration: 0.1 } },
      transition: { duration: 0.12 },
    };
  }
  return {
    initial: { opacity: 0, height: 0 },
    animate: { opacity: 1, height: "auto" },
    exit: {
      opacity: 0,
      height: 0,
      transition: { duration: 0.2, ease: EASE, delay: 0.08 },
    },
    transition: { duration: 0.22, ease: EASE },
  };
}
