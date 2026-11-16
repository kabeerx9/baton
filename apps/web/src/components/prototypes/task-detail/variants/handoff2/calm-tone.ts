import type { Tone } from "../../tone";

/** A hint of color: a soft top glow and a thin border, never a wash. */
export const CALM: Record<
  Tone,
  {
    glow: string;
    border: string;
    ring: string;
    text: string;
    dot: string;
    pill: string;
  }
> = {
  neutral: {
    glow: "from-foreground/[0.04]",
    border: "border-border",
    ring: "text-muted-foreground",
    text: "text-muted-foreground",
    dot: "bg-muted-foreground",
    pill: "bg-muted text-muted-foreground",
  },
  blue: {
    glow: "from-blue-500/[0.08]",
    border: "border-blue-500/20",
    ring: "text-blue-500",
    text: "text-blue-600 dark:text-blue-400",
    dot: "bg-blue-500",
    pill: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  },
  violet: {
    glow: "from-violet-500/[0.08]",
    border: "border-violet-500/20",
    ring: "text-violet-500",
    text: "text-violet-600 dark:text-violet-400",
    dot: "bg-violet-500",
    pill: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
  },
  emerald: {
    glow: "from-emerald-500/[0.08]",
    border: "border-emerald-500/20",
    ring: "text-emerald-500",
    text: "text-emerald-600 dark:text-emerald-400",
    dot: "bg-emerald-500",
    pill: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  amber: {
    glow: "from-amber-500/[0.09]",
    border: "border-amber-500/25",
    ring: "text-amber-500",
    text: "text-amber-600 dark:text-amber-400",
    dot: "bg-amber-500",
    pill: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
};
