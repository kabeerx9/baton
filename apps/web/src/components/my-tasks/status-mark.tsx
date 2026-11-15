import type { AssignedTask } from "@/fetchers/task/get-assigned-tasks";
import { getColumnIcon } from "@/lib/column";
import { getStatusDisplayLabel } from "@/lib/i18n/domain";

/** The task's column: its icon and its name. */
export function StatusMark({
  task,
}: {
  task: Pick<AssignedTask, "status" | "statusName" | "statusIcon">;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 [&_svg]:size-3.5">
      {getColumnIcon(task.status, false, task.statusIcon)}
      {getStatusDisplayLabel(task.status, task.statusName ?? undefined)}
    </span>
  );
}
