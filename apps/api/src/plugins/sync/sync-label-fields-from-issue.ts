import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import db from "../../database";
import { externalLinkTable, taskTable } from "../../database/schema";
import { publishEvent } from "../../events";
import { linkedTaskScope } from "../github/services/integration-task-scope";
import { updateExternalLink } from "../github/services/link-manager";
import { updateTaskStatus } from "../github/services/task-service";
import { withIntegrationLink } from "../github/services/with-integration-link";
import { parseLinkMetadata } from "../github/utils/parse-link-metadata";
import { changedLabelFields } from "./changed-label-fields";
import { isFieldLabel, recordedFieldLabels } from "./field-labels";
import { withSyncLease } from "./lease";
import { SyncLeaseBusyError } from "./lease-busy-error";
import { providerIssue } from "./provider-issue";
import { isTransientProviderError } from "./transient-provider-error";
import { logger } from "../../observability/logger";

// GitHub counts deliveries slower than 10s as failed; replay takes the rest.
const BUDGET_MS = 8_000;
const LEASE_WAIT_MS = 3_000;

type Integration = {
  id: string;
  projectId: string;
  type: string;
  config: string;
};
type Link = { id: string; taskId: string; externalId: string };
type Metadata = {
  syncFieldLabels?: unknown;
  syncLabelFieldsDeferred?: unknown;
};

/** The delivery-wide deadline shared by every integration a webhook reaches. */
export const labelReadDeadline = () => Date.now() + BUDGET_MS;

const metadataOf = (link: { id: string; metadata: string | null }) =>
  parseLinkMetadata<Metadata>(link.metadata, {
    externalLinkId: link.id,
    source: "label_fields",
  });

async function applyLabelFields(
  integration: Integration,
  link: Link,
  labels: string[],
  deferred: unknown,
) {
  await withIntegrationLink(
    link,
    integration,
    async (tx, afterCommit, link) => {
      const task = await tx.query.taskTable.findFirst({
        where: linkedTaskScope(link.taskId, integration.projectId),
        columns: { status: true, priority: true },
      });
      if (!task) return;
      // Re-read the record under this row lock: an outbound sync may have
      // confirmed labels while the provider read ran.
      const metadata = metadataOf(link);
      const known = recordedFieldLabels(metadata);
      if (!known) return;
      const { status, priority } = changedLabelFields(labels, known, task);
      await updateExternalLink(
        link.id,
        {
          metadata: {
            syncFieldLabels: labels.filter(isFieldLabel),
            // A delivery deferred after this read began still needs its own.
            ...(deferred && metadata.syncLabelFieldsDeferred === deferred
              ? { syncLabelFieldsDeferred: null }
              : {}),
          },
        },
        tx,
      );

      if (priority) {
        await tx
          .update(taskTable)
          .set({ priority })
          .where(linkedTaskScope(link.taskId, integration.projectId));
        afterCommit(() =>
          publishEvent("task.updated", {
            projectId: integration.projectId,
            taskId: link.taskId,
          }),
        );
      }

      if (status) {
        const result = await updateTaskStatus(
          link.taskId,
          status,
          tx,
          afterCommit,
        );
        if (result.applied && result.before.status !== result.after.status)
          afterCommit(() =>
            publishEvent("task.status_changed", {
              taskId: result.after.id,
              projectId: result.after.projectId,
              userId: null,
              oldStatus: result.before.status,
              newStatus: result.after.status,
              title: result.after.title,
              assigneeId: result.after.userId,
              type: "status_changed",
            }),
          );
      }
    },
  );
}

/** Reads the issue under the field-label lease; "defer" leaves it to replay. */
async function readAndApply(
  integration: Integration,
  link: Link,
): Promise<"done" | "defer"> {
  try {
    return await withSyncLease(
      `sync-field-labels:${link.id}`,
      async () => {
        const stored = await db.query.externalLinkTable.findFirst({
          where: eq(externalLinkTable.id, link.id),
          columns: { id: true, metadata: true },
        });
        if (!stored) return "done";
        const metadata = metadataOf(stored);
        const deferred = metadata.syncLabelFieldsDeferred;
        if (!recordedFieldLabels(metadata)) {
          logger.error("Issue link has no field-label record", {
            integrationId: integration.id,
            linkId: link.id,
          });
          if (deferred)
            await updateExternalLink(link.id, {
              metadata: { syncLabelFieldsDeferred: null },
            });
          return "done";
        }
        let labels: string[];
        try {
          labels = (await (await providerIssue(integration, link)).read())
            .labels;
        } catch (error) {
          if (isTransientProviderError(error)) return "defer";
          logger.error("Issue labels could not be read", {
            integrationId: integration.id,
            linkId: link.id,
          });
          // Replaying a permanent failure cannot succeed.
          if (deferred)
            await updateExternalLink(link.id, {
              metadata: { syncLabelFieldsDeferred: null },
            });
          return "done";
        }
        await applyLabelFields(integration, link, labels, deferred);
        return "done";
      },
      { maxWaitMs: LEASE_WAIT_MS },
    );
  } catch (error) {
    if (error instanceof SyncLeaseBusyError) return "defer";
    throw error;
  }
}

/**
 * Applies status and priority from the issue's current labels. Webhook label
 * snapshots can predate Baton's latest write, so applying them echoed old
 * values back (#1956). The lease is the one outbound field-label sync holds
 * while it rewrites labels. One attempt runs within the delivery's budget; a
 * busy lease, transient failure or slow provider defers the read to replay.
 * Pass one `deadline` for every integration a delivery reaches.
 */
export async function syncLabelFieldsFromIssue(
  integration: Integration,
  link: Link,
  deadline = labelReadDeadline(),
) {
  const remaining = deadline - Date.now();
  if (remaining <= 0) return defer(integration, link);
  let timedOut = false;
  let timer: NodeJS.Timeout | undefined;
  const work = readAndApply(integration, link);
  // A read that outlives the budget finishes in the background.
  work.catch(() => {
    if (timedOut)
      logger.error("Issue label read failed after deferral", {
        integrationId: integration.id,
        linkId: link.id,
      });
  });
  const budget = new Promise<"defer">((resolve) => {
    timer = setTimeout(() => {
      timedOut = true;
      resolve("defer");
    }, remaining);
  });
  try {
    if ((await Promise.race([work, budget])) === "done") return;
  } finally {
    clearTimeout(timer);
  }
  await defer(integration, link);
}

// A fresh token per deferral: a read that began earlier clears only its own.
async function defer(integration: Integration, link: Link) {
  await withIntegrationLink(link, integration, async (tx, _effects, link) => {
    await updateExternalLink(
      link.id,
      { metadata: { syncLabelFieldsDeferred: randomUUID() } },
      tx,
    );
  });
}
