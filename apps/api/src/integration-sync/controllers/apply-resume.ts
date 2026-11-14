import { confirmedFieldLabels } from "../../plugins/sync/field-labels";
import { randomUUID } from "node:crypto";
import { asc, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { columnTable, taskTable } from "../../database/schema";
import { updateExternalLink } from "../../plugins/github/services/link-manager";
import { parseDeferredIssueEdit } from "../../plugins/github/utils/deferred-issue-edit";
import {
  inboundStamp,
  type SyncStamp,
} from "../../plugins/github/utils/sync-echo";
import { resolveTargetStatus as resolveGithubStatus } from "../../plugins/github/utils/resolve-column";
import {
  recordTaskMutation,
  type TaskBefore,
} from "../../task/controllers/task-mutation-effects";
import type { reviewSyncResume } from "./review-resume";
import { statusWrite } from "../../task-change-request/apply-task-change";
import { cancelPendingRequests } from "../../task-change-request/cancel-pending";
import type { ChangeRequestRow } from "../../task-change-request/response";

export async function applySyncResume(
  review: Awaited<ReturnType<typeof reviewSyncResume>>,
  provider: string,
  source: "baton" | "provider",
  updatedAt: string | null,
  tx: Parameters<typeof recordTaskMutation>[0],
  /** The person who started the resume, for the audit trail. */
  initiatorId: string | null = null,
) {
  const cancelled: ChangeRequestRow[] = [];
  const { task, link } = review;
  let adoption:
    | { before: TaskBefore; after: TaskBefore; integrationId: string }
    | undefined;
  if (source === "provider") {
    let status = { status: task.status, columnId: task.columnId };
    if (review.local.state !== review.remote.state) {
      const columns = await tx
        .select()
        .from(columnTable)
        .where(eq(columnTable.projectId, task.projectId))
        .orderBy(asc(columnTable.position));
      const fallback = columns.find(
        (column) => column.isFinal === (review.remote.state === "closed"),
      );
      if (!fallback)
        throw new HTTPException(409, {
          message: "A matching open or completed column is required",
        });
      const slug = await resolveGithubStatus(
        task.projectId,
        review.remote.state === "closed" ? "issue_closed" : "issue_reopened",
        fallback.slug,
        tx,
      );
      const target = columns.find((column) => column.slug === slug)!;
      status = { status: target.slug, columnId: target.id };
    }
    // Person-started, but it needs integration management permission, so it
    // is a bypass for consent. Like other integration writes it skips the
    // blocker rule; it still bumps the generation and ends open requests.
    // The activity names the person who started it.
    const [after] = await tx
      .update(taskTable)
      .set({
        title: review.remote.title,
        description: review.remote.description,
        ...statusWrite(status.status),
        columnId: status.columnId,
      })
      .where(eq(taskTable.id, task.id))
      .returning();
    if (after && after.status !== task.status)
      cancelled.push(
        ...(await cancelPendingRequests(tx, task.id, "task_changed")),
      );
    await recordTaskMutation(tx, task, after!, initiatorId ?? undefined);
    adoption = {
      before: task,
      after: after!,
      integrationId: review.integration.id,
    };
  }
  const job = parseDeferredIssueEdit(
    JSON.parse(link.metadata ?? "{}").deferredIssueEdit,
  );
  for (const field of ["title", "description", "state"] as const) {
    await updateExternalLink(
      link.id,
      {
        ...(field === "title"
          ? { title: review[source === "baton" ? "local" : "remote"].title }
          : {}),
        ...(source === "baton"
          ? {
              outbound: {
                field,
                value: review.local[field],
                intentId: randomUUID(),
                updatedAt: updatedAt ?? undefined,
                pending: false,
              },
            }
          : {}),
        ...(job ? { completeDeferredEdit: job.id } : {}),
        metadata: {
          syncFilterPaused: false,
          syncResumeUncertain: false,
          syncResumeLabelBaseline: review.remoteIssueLabels,
          ...confirmedFieldLabels(review.remoteIssueLabels),
          ...(source === "provider"
            ? {
                lastSync: {
                  [field]: inboundStamp(
                    (
                      JSON.parse(link.metadata ?? "{}").lastSync as
                        | Record<string, SyncStamp>
                        | undefined
                    )?.[field],
                    review.remote[field],
                    provider,
                    review.remoteIssueUpdatedAt ?? undefined,
                  ),
                },
              }
            : {}),
          state: review[source === "baton" ? "local" : "remote"].state,
        },
        retireUncertainOutbound: field,
      },
      tx,
    );
  }
  return { adoption, cancelled };
}
