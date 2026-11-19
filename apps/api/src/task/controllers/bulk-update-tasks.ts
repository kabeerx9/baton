import { queueStorageCleanup } from "../../storage/cleanup-queue";
import { and, asc, eq, inArray } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  assetTable,
  columnTable,
  labelTable,
  projectTable,
  taskTable,
  userTable,
  taskReminderSentTable,
  workspaceUserTable,
} from "../../database/schema";
import { publishEvent } from "../../events";
import { removeLabelFromGitHub } from "../../plugins/github/utils/sync-label-to-github";
import { assertAssignableUser } from "../../utils/assert-assignable-user";
import { publishTaskMutation } from "./task-mutation-effects";
import { getSubtaskParentProjects } from "../get-subtask-parent-projects";
import {
  assertValidPriority,
  assertValidTaskStatus,
} from "../validate-task-fields";
import { personActor, type TaskActor } from "../../task-change-request/actor";
import {
  cancelPendingRequests,
  cancelPendingRequestsFor,
} from "../../task-change-request/cancel-pending";
import { statusWrite } from "../../task-change-request/apply-task-change";
import {
  decideConsent,
  type TaskChangeKind,
} from "../../task-change-request/consent";
import {
  dispatchRequestEffects,
  finishedEffects,
  type RequestEffect,
} from "../../task-change-request/effects";
import {
  type ConsentTask,
  consentFactsWith,
  loadPersonGrants,
} from "../../task-change-request/load-consent-facts";
import { notifyOutsiderEdit } from "../../task-change-request/notify-outsider-edit";
import { NOT_INVOLVED_MESSAGE } from "../../task-change-request/request-change";
import { checkStatusChange } from "../../task-change-request/status-change";
import type { DbOrTx } from "../../project-access/db-or-tx";
import { deleteResourceNotifications } from "../../notification/delete-resource-notifications";
import { logger } from "../../observability/logger";

export type BulkItemResult =
  | { taskId: string; outcome: "applied" }
  | { taskId: string; outcome: "refused"; reason: string };

/**
 * Decides each task separately against the locked rows. Bulk paths never
 * create requests: a task the caller is not involved in is refused, with the
 * reason, and the others still apply. So is a task not assigned to a caller
 * with task:update_assigned only.
 */
async function refusalsFor(
  tx: DbOrTx,
  actor: TaskActor,
  workspaceId: string,
  tasks: (ConsentTask & { status?: string })[],
  change: TaskChangeKind,
  to?: string,
) {
  const refusals = new Map<string, string>();
  if (actor.kind !== "person") return refusals;
  const grants = await loadPersonGrants(tx, workspaceId, actor);
  // Field edits refuse only task:update_assigned holders; skip the per-task
  // reads for everyone with task:update.
  if (change === "edit" && grants.can({ task: ["update"] })) return refusals;
  for (const task of tasks) {
    const consent = decideConsent(
      change,
      await consentFactsWith(tx, task, actor.userId, grants),
      to !== undefined && task.status !== undefined
        ? { from: task.status, to }
        : undefined,
    );
    if (consent.kind === "request") refusals.set(task.id, NOT_INVOLVED_MESSAGE);
    else if (consent.kind === "deny") refusals.set(task.id, consent.message);
  }
  return refusals;
}

function itemResults(
  ids: string[],
  refusals: Map<string, string>,
): BulkItemResult[] {
  return ids.map((taskId) => {
    const reason = refusals.get(taskId);
    return reason
      ? { taskId, outcome: "refused", reason }
      : { taskId, outcome: "applied" };
  });
}

type BulkOperation =
  | "updateStatus"
  | "updatePriority"
  | "updateAssignee"
  | "delete"
  | "addLabel"
  | "removeLabel"
  | "updateDueDate";

async function bulkUpdateTasks({
  taskIds,
  operation,
  value,
  userId,
  actor = personActor(userId),
}: {
  taskIds: string[];
  operation: BulkOperation;
  value?: string | null;
  userId: string;
  actor?: TaskActor;
}) {
  const tasks = await db
    .select({
      id: taskTable.id,
      title: taskTable.title,
      status: taskTable.status,
      priority: taskTable.priority,
      projectId: taskTable.projectId,
      userId: taskTable.userId,
      dueDate: taskTable.dueDate,
      workspaceId: projectTable.workspaceId,
    })
    .from(taskTable)
    .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
    .where(inArray(taskTable.id, taskIds));

  if (tasks.length === 0) {
    throw new HTTPException(404, {
      message: "No tasks found",
    });
  }

  const workspaceIds = [...new Set(tasks.map((t) => t.workspaceId))];

  if (workspaceIds.length > 1) {
    throw new HTTPException(400, {
      message: "All tasks must belong to the same workspace",
    });
  }

  const workspaceId = workspaceIds[0];

  if (!workspaceId) {
    throw new HTTPException(400, {
      message: "Could not determine workspace",
    });
  }

  const [membership] = await db
    .select({ id: workspaceUserTable.id })
    .from(workspaceUserTable)
    .where(
      and(
        eq(workspaceUserTable.userId, userId),
        eq(workspaceUserTable.workspaceId, workspaceId),
      ),
    )
    .limit(1);

  if (!membership) {
    throw new HTTPException(403, {
      message: "You don't have access to this workspace",
    });
  }

  const foundIds = tasks.map((t) => t.id);
  let updatedCount = 0;
  let refusals = new Map<string, string>();
  const effects: RequestEffect[] = [];

  switch (operation) {
    case "updateStatus": {
      if (!value) {
        throw new HTTPException(400, { message: "Status value is required" });
      }
      const projectIds = [...new Set(tasks.map((t) => t.projectId))];

      // Validate every project's destination before the first write.
      const destinations = new Map<string, string | null>();
      for (const projectId of projectIds) {
        await assertValidTaskStatus(value, projectId);
        const column = await db.query.columnTable.findFirst({
          where: and(
            eq(columnTable.projectId, projectId),
            eq(columnTable.slug, value),
          ),
        });
        destinations.set(projectId, column?.id ?? null);
      }
      const { updatedTasks, beforeById } = await db.transaction(async (tx) => {
        const before = await tx
          .select({
            id: taskTable.id,
            status: taskTable.status,
            projectId: taskTable.projectId,
            createdBy: taskTable.createdBy,
            userId: taskTable.userId,
          })
          .from(taskTable)
          .where(inArray(taskTable.id, foundIds))
          .orderBy(asc(taskTable.id))
          .for("update");
        const beforeById = new Map(before.map((task) => [task.id, task]));
        const changing = before.filter((task) => task.status !== value);
        refusals = await refusalsFor(
          tx,
          actor,
          workspaceId,
          changing,
          "status",
          value,
        );
        // A task already at the destination is still written (updated_at,
        // column): it needs the same right to work on it.
        for (const [id, reason] of await refusalsFor(
          tx,
          actor,
          workspaceId,
          before.filter((task) => task.status === value),
          "edit",
        ))
          refusals.set(id, reason);
        // "Cannot finish while blocked" holds on bulk paths too.
        for (const task of changing) {
          if (refusals.has(task.id)) continue;
          const check = await checkStatusChange(tx, task, value, userId);
          if (!check.ok) refusals.set(task.id, check.message);
        }
        for (const task of changing) {
          if (refusals.has(task.id)) continue;
          effects.push(
            ...finishedEffects(
              await cancelPendingRequests(tx, task.id, "task_changed"),
              userId,
            ),
          );
        }
        const result: Array<{
          id: string;
          projectId: string;
          status: string;
          title: string;
          userId: string | null;
        }> = [];
        for (const projectId of projectIds) {
          const projectTaskIds = tasks
            .filter(
              (task) => task.projectId === projectId && !refusals.has(task.id),
            )
            .map((task) => task.id);
          if (projectTaskIds.length === 0) continue;
          const changed = await tx
            .update(taskTable)
            .set({
              ...statusWrite(value),
              columnId: destinations.get(projectId) ?? null,
            })
            .where(
              and(
                inArray(taskTable.id, projectTaskIds),
                eq(taskTable.projectId, projectId),
              ),
            )
            .returning({
              id: taskTable.id,
              projectId: taskTable.projectId,
              status: taskTable.status,
              title: taskTable.title,
              userId: taskTable.userId,
            });
          if (changed.length !== projectTaskIds.length)
            throw new HTTPException(409, {
              message: "Tasks changed projects; retry the operation",
            });
          result.push(...changed);
        }
        return { updatedTasks: result, beforeById };
      });
      updatedCount = updatedTasks.length;
      await dispatchRequestEffects(effects);
      const parentProjects = await getSubtaskParentProjects(foundIds);
      await publishEvent("subtask-parents.refresh", {
        projects: parentProjects,
      });
      for (const updatedTask of updatedTasks) {
        const before = beforeById.get(updatedTask.id)!;
        await publishTaskMutation(before, updatedTask, userId, {
          fields: ["status"],
          skipRelationRefresh: true,

          skipSubtaskParentRefresh: true,
        });
        if (before.status === updatedTask.status)
          await publishEvent("task.updated", {
            taskId: updatedTask.id,
            projectId: updatedTask.projectId,
            userId,
          });
      }
      for (const projectId of projectIds)
        await publishEvent("task-relation.refresh", { projectId, userId });
      break;
    }

    case "updatePriority": {
      if (!value) {
        throw new HTTPException(400, { message: "Priority value is required" });
      }
      assertValidPriority(value);

      const before = await db.transaction(async (tx) => {
        const locked = await tx
          .select({
            id: taskTable.id,
            projectId: taskTable.projectId,
            title: taskTable.title,
            userId: taskTable.userId,
            createdBy: taskTable.createdBy,
            priority: taskTable.priority,
          })
          .from(taskTable)
          .where(inArray(taskTable.id, foundIds))
          .orderBy(asc(taskTable.id))
          .for("update");
        const originalProjects = new Map(
          tasks.map((task) => [task.id, task.projectId]),
        );
        if (
          locked.length !== foundIds.length ||
          locked.some(
            (task) => task.projectId !== originalProjects.get(task.id),
          )
        )
          throw new HTTPException(409, {
            message: "Tasks changed projects; retry the operation",
          });
        refusals = await refusalsFor(tx, actor, workspaceId, locked, "edit");
        const allowed = locked.filter((task) => !refusals.has(task.id));
        if (allowed.length)
          await tx
            .update(taskTable)
            .set({ priority: value })
            .where(
              inArray(
                taskTable.id,
                allowed.map((task) => task.id),
              ),
            );
        return allowed;
      });
      updatedCount = before.length;
      for (const task of before) {
        await publishTaskMutation(
          task,
          {
            ...task,
            priority: value,
          },
          userId,
          { fields: ["priority"] },
        );
        if (task.priority !== value)
          await notifyOutsiderEdit(task, task.title, userId, ["priority"]);
      }
      break;
    }

    case "updateAssignee": {
      const assigneeId = value?.trim() || null;

      if (assigneeId) {
        await assertAssignableUser(
          assigneeId,
          workspaceId,
          tasks.map((task) => task.projectId),
        );
      }

      const assignee = assigneeId
        ? await db.query.userTable.findFirst({
            columns: { name: true },
            where: eq(userTable.id, assigneeId),
          })
        : undefined;
      const before = await db.transaction(async (tx) => {
        const locked = await tx
          .select({
            id: taskTable.id,
            projectId: taskTable.projectId,
            title: taskTable.title,
            userId: taskTable.userId,
            createdBy: taskTable.createdBy,
          })
          .from(taskTable)
          .where(inArray(taskTable.id, foundIds))
          .orderBy(asc(taskTable.id))
          .for("update");
        const originalProjects = new Map(
          tasks.map((task) => [task.id, task.projectId]),
        );
        if (
          locked.length !== foundIds.length ||
          locked.some(
            (task) => task.projectId !== originalProjects.get(task.id),
          )
        )
          throw new HTTPException(409, {
            message: "Tasks changed projects; retry the operation",
          });
        refusals = await refusalsFor(
          tx,
          actor,
          workspaceId,
          locked.filter((task) => task.userId !== assigneeId),
          "assign",
        );
        const allowed = locked.filter((task) => !refusals.has(task.id));
        // A new assignee changes who must consent: open requests end.
        effects.push(
          ...finishedEffects(
            await cancelPendingRequestsFor(
              tx,
              allowed
                .filter((task) => task.userId !== assigneeId)
                .map((task) => task.id),
              "task_changed",
            ),
            userId,
          ),
        );
        if (allowed.length)
          await tx
            .update(taskTable)
            .set({ userId: assigneeId })
            .where(
              inArray(
                taskTable.id,
                allowed.map((task) => task.id),
              ),
            );
        return allowed;
      });
      updatedCount = before.length;
      await dispatchRequestEffects(effects);
      for (const task of before)
        await publishTaskMutation(
          task,
          {
            ...task,
            userId: assigneeId,
          },
          userId,
          { fields: ["userId"], assigneeName: assignee?.name ?? null },
        );
      break;
    }

    case "delete": {
      // Relations cascade away with the children, so capture parents first.
      const parentProjects = await getSubtaskParentProjects(foundIds);
      const result = await db.transaction(async (tx) => {
        const locked = await tx
          .select({
            id: taskTable.id,
            projectId: taskTable.projectId,
            createdBy: taskTable.createdBy,
            userId: taskTable.userId,
          })
          .from(taskTable)
          .where(inArray(taskTable.id, foundIds))
          .orderBy(asc(taskTable.id))
          .for("update");
        const originalProjects = new Map(
          tasks.map((task) => [task.id, task.projectId]),
        );
        if (
          locked.length !== foundIds.length ||
          locked.some(
            (task) => task.projectId !== originalProjects.get(task.id),
          )
        )
          throw new HTTPException(409, {
            message: "Tasks changed projects; retry the operation",
          });
        refusals = await refusalsFor(tx, actor, workspaceId, locked, "delete");
        const deleting = foundIds.filter((id) => !refusals.has(id));
        if (deleting.length === 0) return { rowCount: 0 };
        // The delete below sets their stored task_id to null; send the
        // requesters rows that match, or the notifications are dropped.
        for (const id of deleting)
          effects.push(
            ...finishedEffects(
              (await cancelPendingRequests(tx, id, "task_deleted")).map(
                (request) => ({ ...request, taskId: null }),
              ),
              userId,
            ),
          );
        const assets = await tx
          .select({ objectKey: assetTable.objectKey })
          .from(assetTable)
          .where(inArray(assetTable.taskId, deleting));
        await queueStorageCleanup(
          tx,
          assets.map((asset) => asset.objectKey),
        );
        await deleteResourceNotifications(tx, { taskIds: deleting });
        return tx.delete(taskTable).where(inArray(taskTable.id, deleting));
      });

      updatedCount = result.rowCount ?? foundIds.length - refusals.size;
      await dispatchRequestEffects(effects);

      for (const task of tasks.filter((task) => !refusals.has(task.id))) {
        await publishEvent("task.deleted", {
          taskId: task.id,
          projectId: task.projectId,
          userId,
          title: task.title,
        });
      }
      await publishEvent("subtask-parents.refresh", {
        projects: parentProjects,
      });
      break;
    }

    case "addLabel": {
      if (!value) {
        throw new HTTPException(400, { message: "Label ID is required" });
      }

      const label = await db.query.labelTable.findFirst({
        where: eq(labelTable.id, value),
      });

      if (!label) {
        throw new HTTPException(404, { message: "Label not found" });
      }

      if (label.workspaceId && label.workspaceId !== workspaceId) {
        throw new HTTPException(400, {
          message: "Label and tasks must belong to the same workspace",
        });
      }

      for (const task of tasks) {
        const existingAssignment = await db.query.labelTable.findFirst({
          where: and(
            eq(labelTable.name, label.name),
            eq(labelTable.taskId, task.id),
          ),
        });

        if (!existingAssignment) {
          await db
            .insert(labelTable)
            .values({
              name: label.name,
              color: label.color,
              workspaceId: workspaceId,
              taskId: task.id,
            })
            .onConflictDoNothing({
              target: [labelTable.taskId, labelTable.name],
            });
          updatedCount++;

          await publishEvent("task.label_assigned", {
            projectId: task.projectId,
            taskId: task.id,
            userId,
            type: "label_assigned",
          });
        }
      }
      break;
    }

    case "removeLabel": {
      if (!value) {
        throw new HTTPException(400, { message: "Label ID is required" });
      }

      const label = await db.query.labelTable.findFirst({
        where: eq(labelTable.id, value),
      });

      if (!label) {
        throw new HTTPException(404, { message: "Label not found" });
      }

      const deletedLabels = await db
        .delete(labelTable)
        .where(
          and(
            eq(labelTable.workspaceId, workspaceId),
            eq(labelTable.name, label.name),
            inArray(labelTable.taskId, foundIds),
          ),
        )
        .returning();

      updatedCount = deletedLabels.length;

      for (const deletedLabel of deletedLabels) {
        if (!deletedLabel.taskId) continue;

        removeLabelFromGitHub(deletedLabel.taskId, deletedLabel.name).catch(
          (error) => {
            logger.error("Failed to remove label from GitHub", { error });
          },
        );

        const task = tasks.find((t) => t.id === deletedLabel.taskId);
        if (!task) continue;

        await publishEvent("task.label_unassigned", {
          label: deletedLabel,
          task,
          projectId: task.projectId,
          taskId: deletedLabel.taskId,
          userId,
          type: "label_unassigned",
        });
      }
      break;
    }

    case "updateDueDate": {
      let parsedDate: Date | null = null;
      if (value) {
        parsedDate = new Date(value);
        if (Number.isNaN(parsedDate.getTime())) {
          throw new HTTPException(400, {
            message: `Invalid date value "${value}"`,
          });
        }
      }

      const { updatedTasks, beforeById } = await db.transaction(async (tx) => {
        const before = await tx
          .select({
            id: taskTable.id,
            projectId: taskTable.projectId,
            dueDate: taskTable.dueDate,
            userId: taskTable.userId,
            createdBy: taskTable.createdBy,
          })
          .from(taskTable)
          .where(inArray(taskTable.id, foundIds))
          .orderBy(asc(taskTable.id))
          .for("update");
        const originalProjects = new Map(
          tasks.map((task) => [task.id, task.projectId]),
        );
        if (
          before.length !== foundIds.length ||
          before.some(
            (task) => task.projectId !== originalProjects.get(task.id),
          )
        )
          throw new HTTPException(409, {
            message: "Tasks changed projects; retry the operation",
          });
        const beforeById = new Map(before.map((task) => [task.id, task]));
        refusals = await refusalsFor(tx, actor, workspaceId, before, "edit");
        const allowedIds = foundIds.filter((id) => !refusals.has(id));
        if (allowedIds.length === 0) return { updatedTasks: [], beforeById };
        const changedIds = before
          .filter(
            (task) =>
              !refusals.has(task.id) &&
              task.dueDate?.getTime() !== parsedDate?.getTime(),
          )
          .map((task) => task.id);
        if (changedIds.length)
          await tx
            .delete(taskReminderSentTable)
            .where(inArray(taskReminderSentTable.taskId, changedIds));
        const updatedTasks = await tx
          .update(taskTable)
          .set({ dueDate: parsedDate })
          .where(inArray(taskTable.id, allowedIds))
          .returning({
            id: taskTable.id,
            projectId: taskTable.projectId,
            title: taskTable.title,
            dueDate: taskTable.dueDate,
          });
        return { updatedTasks, beforeById };
      });
      updatedCount = updatedTasks.length;
      for (const updatedTask of updatedTasks) {
        const before = beforeById.get(updatedTask.id)!;
        await publishTaskMutation(before, updatedTask, userId, {
          fields: ["dueDate"],
        });
        if (before.dueDate?.getTime() !== updatedTask.dueDate?.getTime())
          await notifyOutsiderEdit(
            { ...before, userId: before.userId, createdBy: before.createdBy },
            updatedTask.title,
            userId,
            ["due date"],
          );
      }
      break;
    }

    default: {
      throw new HTTPException(400, {
        message: `Unknown operation "${operation}"`,
      });
    }
  }

  return {
    success: true,
    updatedCount,
    results: itemResults(foundIds, refusals),
  };
}

export default bulkUpdateTasks;
