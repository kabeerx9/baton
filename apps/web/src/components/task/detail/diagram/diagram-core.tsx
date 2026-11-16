import { motion } from "motion/react";
import { useTranslation } from "react-i18next";
import type { Status } from "@/components/board/model";
import { StatusIcon } from "@/components/board/status-icon";

const R = 58;
const C = 2 * Math.PI * R;

const TONE = {
  neutral: "text-muted-foreground",
  amber: "text-amber-500",
  violet: "text-violet-500",
  emerald: "text-emerald-500",
  blue: "text-blue-500",
} as const;
export type CoreTone = keyof typeof TONE;

/**
 * The circle: the status as a glyph and a word, in a ring that fills as the
 * task moves through the project's steps. It is a picture; the bar changes status.
 */
export function DiagramCore({
  label,
  glyph,
  progress,
  tone,
}: {
  label: string;
  glyph: Status;
  /** 0 to 1: position among the project's steps. */
  progress: number;
  tone: CoreTone;
}) {
  const { t } = useTranslation();
  return (
    <div
      role="img"
      aria-label={t("tasks:hero.status.circleLabel", { status: label })}
      className="relative grid size-[176px] shrink-0 place-items-center rounded-full border border-border bg-card"
    >
      <svg
        viewBox="0 0 140 140"
        className={`absolute inset-0 -rotate-90 ${TONE[tone]}`}
        aria-hidden="true"
      >
        <circle
          cx="70"
          cy="70"
          r={R}
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.14}
          strokeWidth={5}
        />
        <motion.circle
          cx="70"
          cy="70"
          r={R}
          fill="none"
          stroke="currentColor"
          strokeWidth={5}
          strokeLinecap="round"
          strokeDasharray={C}
          initial={{ strokeDashoffset: C }}
          animate={{ strokeDashoffset: C * (1 - Math.max(progress, 0.04)) }}
          transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
        />
      </svg>
      <span className="relative flex max-w-[120px] flex-col items-center gap-1 text-center">
        <StatusIcon status={glyph} size={30} />
        <span className="line-clamp-2 font-semibold text-lg leading-tight">
          {label}
        </span>
      </span>
    </div>
  );
}
