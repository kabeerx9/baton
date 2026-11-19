import type { InferSelectModel } from "drizzle-orm";
import { and, eq } from "drizzle-orm";
import db from "../../../database";
import {
  columnTable,
  integrationTable,
  taskTable,
} from "../../../database/schema";
import { type GitHubConfig, hasVerifiedGitHubBinding } from "../config";
import { extractTaskLinks } from "../utils/task-references";

import type { IntegrationDatabase } from "./integration-task-scope";
import { activeIntegrationCondition } from "../../active-integration-condition";
import { applyTaskChange } from "../../../task-change-request/apply-task-change";
import {
  dispatchRequestEffects,
  finishedEffects,
} from "../../../task-change-request/effects";
import type { TaskTransaction } from "../../../task/controllers/with-locked-task";
import { logger } from "../../../observability/logger";

export type TaskRow = InferSelectModel<typeof taskTable>;

export type UpdateTaskStatusResult =
  | { applied: false }
  | { applied: true; before: TaskRow; after: TaskRow };

const NON_COLUMN_STATUSES = new Set(["planned", "archived"]);

export async function findTaskByNumber(
  projectId: string,
  taskNumber: number,
  database: Pick<typeof db, "query"> = db,
) {
  return database.query.taskTable.findFirst({
    where: and(
      eq(taskTable.projectId, projectId),
      eq(taskTable.number, taskNumber),
    ),
  });
}

export async function findTaskByLink(
  projectId: string,
  texts: (string | null | undefined)[],
  database: Pick<typeof db, "query"> = db,
) {
  const links = extractTaskLinks(...texts);
  const link = links.length === 1 ? links[0] : undefined;
  if (link?.projectId !== projectId) return;

  return database.query.taskTable.findFirst({
    where: and(
      eq(taskTable.projectId, projectId),
      eq(taskTable.id, link.taskId),
    ),
  });
}

export async function findTaskById(
  taskId: string,
  database: Pick<typeof db, "query"> = db,
) {
  return database.query.taskTable.findFirst({
    where: eq(taskTable.id, taskId),
  });
}

/**
 * The integration status setter: a system write through `applyTaskChange`.
 * It skips consent and the blocker rule (GitHub is the source of truth for
 * what was merged or closed) but still bumps the status generation and
 * cancels any pending change request on the task, in the caller's
 * transaction.
 */
/**
 * Sets a status from GitHub, as a system writer. A pending change request
 * on the task is cancelled; its requester is told through `afterCommit`
 * (the caller's post-commit queue), or right after this function's own
 * transaction when it opens one.
 */
export async function updateTaskStatus(
  taskId: string,
  newStatus: string,
  database: IntegrationDatabase = db,
  afterCommit?: (effect: () => Promise<void>) => void,
): Promise<UpdateTaskStatusResult> {
  if (database === db) {
    const effects: Array<() => Promise<void>> = [];
    const result = await db.transaction((tx) =>
      updateTaskStatus(taskId, newStatus, tx, (effect) => effects.push(effect)),
    );
    for (const effect of effects) await effect();
    return result;
  }
  const tx = database as TaskTransaction;
  const task = await tx.query.taskTable.findFirst({
    where: eq(taskTable.id, taskId),
  });

  if (!task) {
    return { applied: false };
  }

  if (
    !NON_COLUMN_STATUSES.has(newStatus) &&
    !(await tx.query.columnTable.findFirst({
      where: and(
        eq(columnTable.projectId, task.projectId),
        eq(columnTable.slug, newStatus),
      ),
    }))
  ) {
    logger.warn(
      `[GitHub] Skipping status update for task ${taskId}: column "${newStatus}" not found in project ${task.projectId}`,
    );
    return { applied: false };
  }

  const result = await applyTaskChange(
    tx,
    { kind: "system", userId: null },
    task,
    { kind: "status", status: newStatus },
  );
  if (!result.ok || result.kind !== "status") return { applied: false };
  const cancelled = result.cancelled;
  if (cancelled.length)
    afterCommit?.(() =>
      dispatchRequestEffects(finishedEffects(cancelled, null)),
    );

  return { applied: true, before: task, after: result.after };
}

export async function isTaskInFinalState(
  task: {
    projectId: string;
    status: string;
    columnId: string | null;
  },
  database: Pick<typeof db, "query"> = db,
): Promise<boolean> {
  if (task.columnId) {
    const columnById = await database.query.columnTable.findFirst({
      where: and(
        eq(columnTable.id, task.columnId),
        eq(columnTable.projectId, task.projectId),
      ),
    });

    if (columnById) {
      return columnById.isFinal;
    }
  }

  const columnByStatus = await database.query.columnTable.findFirst({
    where: and(
      eq(columnTable.projectId, task.projectId),
      eq(columnTable.slug, task.status),
    ),
  });

  if (columnByStatus) {
    return columnByStatus.isFinal;
  }

  return task.status === "done";
}

export async function getIntegrationWithProject(integrationId: string) {
  return db.query.integrationTable.findFirst({
    where: eq(integrationTable.id, integrationId),
    with: {
      project: true,
    },
  });
}

export type GitHubWebhookSource = {
  installation?: { id: number };
  repository: { id: number };
};

export async function findAllIntegrationsByRepo(source: GitHubWebhookSource) {
  const installationId = source.installation?.id;
  const repositoryId = source.repository.id;
  if (
    !Number.isSafeInteger(installationId) ||
    !Number.isSafeInteger(repositoryId)
  )
    return [];
  const integrations = await db.query.integrationTable.findMany({
    where: and(
      eq(integrationTable.type, "github"),
      activeIntegrationCondition(),
    ),
    with: { project: true },
  });
  return integrations.filter((integration) => {
    try {
      const config = JSON.parse(integration.config) as GitHubConfig;
      return (
        hasVerifiedGitHubBinding(config) &&
        config.installationId === installationId &&
        config.repositoryId === repositoryId
      );
    } catch {
      return false;
    }
  });
}
