import type { CoreTone } from "./diagram/diagram-core";

/** The page's one accent: it marks the status ring and the hero's top glow. */
export function heroTone({
  unknown,
  done,
  pendingRequest,
  blocked,
  started,
}: {
  unknown: boolean;
  done: boolean;
  pendingRequest: boolean;
  blocked: boolean;
  started: boolean;
}): CoreTone {
  if (unknown) return "neutral";
  if (done) return "emerald";
  if (pendingRequest) return "violet";
  if (blocked) return "amber";
  return started ? "blue" : "neutral";
}

export const TONE_STYLE: Record<
  CoreTone,
  { glow: string; border: string; text: string; dot: string }
> = {
  neutral: {
    glow: "from-foreground/[0.04]",
    border: "border-border",
    text: "text-muted-foreground",
    dot: "bg-muted-foreground",
  },
  blue: {
    glow: "from-blue-500/[0.08]",
    border: "border-blue-500/20",
    text: "text-blue-600 dark:text-blue-400",
    dot: "bg-blue-500",
  },
  violet: {
    glow: "from-violet-500/[0.08]",
    border: "border-violet-500/20",
    text: "text-violet-600 dark:text-violet-400",
    dot: "bg-violet-500",
  },
  emerald: {
    glow: "from-emerald-500/[0.08]",
    border: "border-emerald-500/20",
    text: "text-emerald-600 dark:text-emerald-400",
    dot: "bg-emerald-500",
  },
  amber: {
    glow: "from-amber-500/[0.09]",
    border: "border-amber-500/25",
    text: "text-amber-600 dark:text-amber-400",
    dot: "bg-amber-500",
  },
};
