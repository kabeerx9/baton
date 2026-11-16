import type { QueryClient } from "@tanstack/react-query";
import type { AssignedTasks } from "@/fetchers/task/get-assigned-tasks";

/**
 * Shows a moved due date at once in every cached list of assigned tasks. The
 * server's answer replaces it: the due-date mutation refetches these lists.
 */
export function patchAssignedDueDate(
  queryClient: QueryClient,
  taskId: string,
  dueDate: string | null,
) {
  queryClient.setQueriesData<AssignedTasks>(
    { queryKey: ["assigned-tasks"] },
    (lists) =>
      lists?.tasks.some((task) => task.id === taskId)
        ? {
            ...lists,
            tasks: lists.tasks.map((task) =>
              task.id === taskId ? { ...task, dueDate } : task,
            ),
          }
        : lists,
  );
}
