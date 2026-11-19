import { useQuery } from "@tanstack/react-query";
import getTask from "@/fetchers/task/get-task";

/**
 * The task's assignee id, read from the shared `["task", id]` cache. Unlike
 * `useGetTask`, mounting it never refetches a task already cached, so many
 * comment cards on one task cost no extra requests.
 */
export default function useTaskAssignee(taskId: string) {
  const { data } = useQuery({
    queryKey: ["task", taskId],
    queryFn: () => getTask(taskId),
    enabled: Boolean(taskId),
    staleTime: Number.POSITIVE_INFINITY,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
  return data?.userId ?? null;
}
