import { getPriorityLabel } from "@/lib/i18n/domain";
import { getPriorityIcon } from "@/lib/priority";

const MARKED = new Set(["urgent", "high"]);

/** A small mark on a card for urgent and high work. Other priorities draw nothing. */
export function PriorityMark({ priority }: { priority: string | null }) {
  if (!priority || !MARKED.has(priority)) return null;
  const label = getPriorityLabel(priority);
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className="inline-flex items-center [&_svg]:size-3.5"
    >
      {getPriorityIcon(priority)}
    </span>
  );
}
