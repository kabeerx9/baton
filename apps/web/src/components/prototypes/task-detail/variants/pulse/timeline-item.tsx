import { motion } from "motion/react";
import { Avatar } from "@/components/board/avatar";
import { ActivityIcon, describeChange } from "../../shared/activity-visual";
import type { TimelineItem } from "../../timeline-events";

const rise = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
};

/** A dot on the rail, then the content. The rail itself is drawn by the list. */
export function PulseTimelineItem({
  item,
  index,
}: {
  item: TimelineItem;
  index: number;
}) {
  const transition = {
    duration: 0.28,
    ease: [0.23, 1, 0.32, 1] as const,
    delay: Math.min(index, 8) * 0.04,
  };
  if (item.kind === "now") {
    const count = item.waitingOn.length + item.waitedBy.length;
    return (
      <motion.li
        layout="position"
        {...rise}
        transition={transition}
        className="relative pl-10"
      >
        <span className="absolute top-1 left-2.5 grid size-5 place-items-center">
          <span
            className="proto-ping absolute size-5 rounded-full bg-foreground/40"
            aria-hidden="true"
          />
          <span className="relative size-2.5 rounded-full bg-foreground" />
        </span>
        <p className="text-sm font-semibold">Now</p>
        <p className="text-sm text-muted-foreground">
          {count === 0
            ? "No other task is involved. It is all in this thread."
            : [
                item.waitingOn.length > 0
                  ? `Waiting on ${item.waitingOn.map((t) => t.key).join(", ")}`
                  : null,
                item.waitedBy.length > 0
                  ? `${item.waitedBy.map((t) => t.key).join(", ")} ${item.waitedBy.length === 1 ? "waits" : "wait"} on this`
                  : null,
              ]
                .filter(Boolean)
                .join(" · ")}
        </p>
      </motion.li>
    );
  }
  const e = item.entry;
  return (
    <motion.li
      layout="position"
      {...rise}
      transition={transition}
      className="relative pl-10"
    >
      <span className="absolute top-0.5 left-0 grid size-8 place-items-center rounded-full border border-border bg-card text-muted-foreground">
        {e.kind === "comment" ? (
          <Avatar person={e.actor} size={22} />
        ) : (
          <ActivityIcon kind={e.kind} />
        )}
      </span>
      <div className="flex items-baseline gap-2 text-sm">
        <b className="font-medium">{e.actor.name.split(" ")[0]}</b>
        <span className="min-w-0 truncate text-muted-foreground">
          {describeChange(e)}
        </span>
        <span className="ml-auto shrink-0 text-xs text-muted-foreground">
          {e.at}
        </span>
      </div>
      {e.kind === "comment" && (
        <p className="mt-1.5 rounded-2xl rounded-tl-md border border-border bg-card px-3.5 py-2.5 text-sm leading-relaxed shadow-xs/5">
          {e.body}
        </p>
      )}
    </motion.li>
  );
}
