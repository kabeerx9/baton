import { useGetColumns } from "@/hooks/queries/column/use-get-columns";
import useGetLabelsByTask from "@/hooks/queries/label/use-get-labels-by-task";
import useGetProject from "@/hooks/queries/project/use-get-project";
import useGetProjects from "@/hooks/queries/project/use-get-projects";
import useGetTask from "@/hooks/queries/task/use-get-task";
import useGetWorkspaceUsers from "@/hooks/queries/workspace-users/use-get-workspace-users";
import { getDueDateStatus, isTaskCompleted } from "@/lib/due-date-status";
import { getStatusDisplayLabel } from "@/lib/i18n/domain";
import { useTaskStatusStore } from "@/store/task-status/store";
import { shownStatus } from "@/store/task-status/transition";

export function useTaskProperties(
  taskId: string,
  projectId: string,
  workspaceId: string,
) {
  const { data: task } = useGetTask(taskId);
  const { data: project } = useGetProject({ id: projectId, workspaceId });
  const { data: columns = [] } = useGetColumns(projectId);
  const { data: workspaceUsers } = useGetWorkspaceUsers(workspaceId);
  const { data: labels = [] } = useGetLabelsByTask(taskId);
  const { data: workspaceProjects = [] } = useGetProjects({ workspaceId });

  const entry = useTaskStatusStore((state) => state.entries[taskId]);
  // The status to show: the server value, or the target of a write in flight.
  const shown = task ? shownStatus(task, entry) : "";
  const statusColumn = columns.find(
    (column) => column.slug === shown || column.id === shown,
  );

  return {
    task,
    project,
    labels,
    status: {
      slug: shown,
      label: getStatusDisplayLabel(shown, statusColumn?.name),
      isFinal: statusColumn?.isFinal ?? false,
      icon: statusColumn?.icon,
    },
    assignee: workspaceUsers?.find((member) => member.id === task?.userId),
    dueStatus: getDueDateStatus(
      task?.dueDate ?? null,
      isTaskCompleted(shown, columns),
    ),
    canMoveTask:
      Boolean(task) &&
      workspaceProjects.some((project) => project.id !== task?.projectId),
  };
}
