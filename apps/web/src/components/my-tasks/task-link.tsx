import { Link } from "@tanstack/react-router";
import type { ComponentProps } from "react";
import type { AssignedTask } from "@/fetchers/task/get-assigned-tasks";

/** A link to the one page for a task. */
export function TaskLink({
  task,
  workspaceId,
  ...props
}: {
  task: Pick<AssignedTask, "id" | "projectId">;
  workspaceId: string;
} & Omit<ComponentProps<"a">, "href">) {
  return (
    <Link
      params={{ workspaceId, projectId: task.projectId, taskId: task.id }}
      to="/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId"
      {...props}
    />
  );
}
