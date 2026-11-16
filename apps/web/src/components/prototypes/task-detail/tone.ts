import type { PageState } from "./derive";

export type Tone = "neutral" | "blue" | "violet" | "emerald" | "amber";

/** One color per page state. Written in full so Tailwind finds every class. */
export const TONE_CLASS: Record<
  Tone,
  {
    text: string;
    dot: string;
    soft: string;
    ring: string;
    wash: string;
    solid: string;
    border: string;
    glow: string;
  }
> = {
  neutral: {
    text: "text-foreground",
    dot: "bg-muted-foreground",
    soft: "bg-muted text-foreground",
    ring: "ring-foreground/10",
    wash: "from-foreground/[0.04] via-transparent to-transparent",
    solid: "bg-foreground text-background",
    border: "border-foreground/15",
    glow: "shadow-[0_0_40px_-8px_var(--color-neutral-500)]",
  },
  blue: {
    text: "text-blue-600 dark:text-blue-400",
    dot: "bg-blue-500",
    soft: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
    ring: "ring-blue-500/30",
    wash: "from-blue-500/15 via-blue-500/5 to-transparent",
    solid: "bg-blue-600 text-white",
    border: "border-blue-500/30",
    glow: "shadow-[0_0_44px_-10px_var(--color-blue-500)]",
  },
  violet: {
    text: "text-violet-600 dark:text-violet-400",
    dot: "bg-violet-500",
    soft: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
    ring: "ring-violet-500/30",
    wash: "from-violet-500/15 via-violet-500/5 to-transparent",
    solid: "bg-violet-600 text-white",
    border: "border-violet-500/30",
    glow: "shadow-[0_0_44px_-10px_var(--color-violet-500)]",
  },
  emerald: {
    text: "text-emerald-600 dark:text-emerald-400",
    dot: "bg-emerald-500",
    soft: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    ring: "ring-emerald-500/30",
    wash: "from-emerald-500/15 via-emerald-500/5 to-transparent",
    solid: "bg-emerald-600 text-white",
    border: "border-emerald-500/30",
    glow: "shadow-[0_0_44px_-10px_var(--color-emerald-500)]",
  },
  amber: {
    text: "text-amber-600 dark:text-amber-400",
    dot: "bg-amber-500",
    soft: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
    ring: "ring-amber-500/30",
    wash: "from-amber-500/15 via-amber-500/5 to-transparent",
    solid: "bg-amber-500 text-black",
    border: "border-amber-500/30",
    glow: "shadow-[0_0_44px_-10px_var(--color-amber-500)]",
  },
};

export function toneOf(state: PageState): Tone {
  switch (state.kind) {
    case "done":
      return "emerald";
    case "awaiting":
      return "violet";
    case "blocked":
      return "amber";
    case "active":
      return state.stage === "doing"
        ? "blue"
        : state.stage === "review"
          ? "violet"
          : "neutral";
    case "unknown":
      return "neutral";
  }
}

export const STATUS_TONE = {
  todo: "neutral",
  doing: "blue",
  review: "violet",
  done: "emerald",
} as const satisfies Record<string, Tone>;

export const PRIORITY_LABEL = {
  none: "No priority",
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
} as const;

export const PRIORITY_COLOR = {
  none: "bg-muted-foreground/30",
  low: "bg-priority-low",
  medium: "bg-priority-medium",
  high: "bg-priority-high",
  urgent: "bg-priority-urgent",
} as const;

export const PRIORITY_BARS = {
  none: 0,
  low: 1,
  medium: 2,
  high: 3,
  urgent: 4,
} as const;

/** Saturated bands for the Pulse header. Light text on every one. */
export const BAND_CLASS: Record<Tone, string> = {
  neutral: "from-neutral-700 via-neutral-800 to-neutral-900",
  blue: "from-blue-500 via-blue-600 to-indigo-700",
  violet: "from-violet-500 via-violet-600 to-purple-800",
  emerald: "from-emerald-500 via-emerald-600 to-teal-700",
  amber: "from-amber-500 via-orange-500 to-orange-700",
};
