import { PriorityMarks } from "@/components/task-chips/priority-marks";
import { getPriorityLabel } from "@/lib/i18n/domain";

export function PriorityMark({ priority }: { priority: string | null }) {
  return (
    <span
      className="inline-flex size-4 shrink-0 items-center justify-center"
      title={getPriorityLabel(priority ?? "no-priority")}
    >
      <PriorityMarks priority={priority} />
    </span>
  );
}
