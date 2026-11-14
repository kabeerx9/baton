import { Link } from "@tanstack/react-router";
import type { RelatedTask } from "./linked";

export function TaskLink({
  task,
  taskKey,
  workspaceId,
  className,
}: {
  task: RelatedTask;
  taskKey: string;
  workspaceId: string;
  className?: string;
}) {
  return (
    <Link
      to="/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId"
      params={{ workspaceId, projectId: task.projectId, taskId: task.id }}
      className={`flex min-w-0 flex-1 items-center gap-2 rounded-md py-1 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring ${className ?? ""}`}
    >
      <span className="shrink-0 font-mono text-xs">{taskKey}</span>
      <span className="truncate">{task.title}</span>
    </Link>
  );
}
