import { useQuery } from "@tanstack/react-query";
import canAnswerChangeRequest from "@/fetchers/task-change-request/can-answer-change-request";

/** Ids of the task's pending requests the caller may answer. Keyed by request id so a new request asks again. */
export function useCanAnswerChangeRequest({
  workspaceId,
  taskId,
  requestId,
}: {
  workspaceId: string;
  taskId: string;
  requestId: string | undefined;
}) {
  return useQuery({
    queryKey: ["change-request-answerable", taskId, requestId],
    queryFn: () => canAnswerChangeRequest(workspaceId, taskId),
    enabled: Boolean(requestId && workspaceId),
    staleTime: 0,
    select: (ids) => ids.includes(requestId ?? ""),
  });
}
