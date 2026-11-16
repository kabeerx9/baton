import { PendingIndicator } from "@/components/task/change-request/pending-indicator";
import type { AssignedTask } from "@/fetchers/task/get-assigned-tasks";
import { useBoardMemberName } from "@/hooks/queries/board/use-board-member-name";

/** The app's marker for an open change request on a task, with who asked. */
export function PendingMark({
  task,
  workspaceId,
}: {
  task: Pick<AssignedTask, "pendingRequest">;
  workspaceId: string;
}) {
  const nameOf = useBoardMemberName(workspaceId);
  if (!task.pendingRequest) return null;
  return (
    <PendingIndicator
      request={task.pendingRequest}
      requesterName={nameOf(task.pendingRequest.requestedBy)}
    />
  );
}
