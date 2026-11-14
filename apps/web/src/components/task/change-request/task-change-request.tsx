import { useMemo, useState } from "react";
import useAuth from "@/components/providers/auth-provider/hooks/use-auth";
import type { Decision } from "@/fetchers/task-change-request/decide-change-request";
import { HttpError } from "@/lib/http-error";
import { useDecideChangeRequest } from "@/hooks/mutations/task-change-request/use-decide-change-request";
import { useBoardMemberName } from "@/hooks/queries/board/use-board-member-name";
import { useGetColumns } from "@/hooks/queries/column/use-get-columns";
import { useCanAnswerChangeRequest } from "@/hooks/queries/task-change-request/use-can-answer-change-request";
import { useGetChangeRequest } from "@/hooks/queries/task-change-request/use-get-change-request";
import useGetTask from "@/hooks/queries/task/use-get-task";
import { getStatusLabel } from "@/lib/i18n/domain";
import { ChangeRequestBanner } from "./change-request-banner";
import { appliesOnTimeout, deriveBanner } from "./model";

/**
 * The pending change request on the task page. The task's `pendingRequest`
 * says there is one; the request itself adds when and from which status. The
 * server decides who may answer, so nothing here re-derives permissions.
 */
export function TaskChangeRequest({
  taskId,
  projectId,
  workspaceId,
}: {
  taskId: string;
  projectId: string;
  workspaceId: string;
}) {
  const { user } = useAuth();
  const { data: task } = useGetTask(taskId);
  const summary = task?.pendingRequest ?? null;
  const decide = useDecideChangeRequest(taskId);
  const activeId = summary?.id ?? decide.variables?.id;
  const { data: detail } = useGetChangeRequest(activeId);
  const { data: canAnswer = false } = useCanAnswerChangeRequest({
    workspaceId,
    taskId,
    requestId: summary?.id,
  });
  const { data: columns } = useGetColumns(projectId);
  const nameOf = useBoardMemberName(workspaceId);
  const [now] = useState(() => Date.now());
  const finalSlugs = useMemo(
    () =>
      columns
        ? new Set(columns.filter((c) => c.isFinal).map((c) => c.slug))
        : undefined,
    [columns],
  );

  const state = deriveBanner({
    summary,
    detail,
    canAnswer,
    userId: user?.id,
    mutation: {
      status: decide.status,
      requestId: decide.variables?.id,
      decision: decide.variables?.decision,
      resultState: decide.data?.request.state,
      errorStatus:
        decide.error instanceof HttpError ? decide.error.status : undefined,
    },
  });
  if (state.kind === "hidden") return null;

  const request = state.request;
  return (
    <div className="mb-6">
      <ChangeRequestBanner
        appliesOnTimeout={
          request ? appliesOnTimeout(request, finalSlugs) : false
        }
        now={now}
        onDecide={(decision: Decision) => {
          if (request) decide.mutate({ id: request.id, decision });
        }}
        onDismiss={() => decide.reset()}
        requesterName={nameOf(request?.requestedBy)}
        state={state}
        statusLabel={getStatusLabel}
      />
    </div>
  );
}
