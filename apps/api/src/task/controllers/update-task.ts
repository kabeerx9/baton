import { and, eq, getTableColumns, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { columnTable, projectTable, taskTable } from "../../database/schema";
import { publishEvent } from "../../events";
import {
  publishTaskMutation,
  recordTaskMutation,
} from "./task-mutation-effects";
import {
  assertAssignableUser,
  getProjectWorkspaceId,
} from "../../utils/assert-assignable-user";
import { boardDescription, descriptionDeferred } from "../description-pages";
import { assertValidTaskStatus } from "../validate-task-fields";
import { assertTaskPosition } from "./next-task-position";
import { personActor, type TaskActor } from "../../task-change-request/actor";
import { cancelPendingRequests } from "../../task-change-request/cancel-pending";
import { decideConsent } from "../../task-change-request/consent";
import {
  dispatchRequestEffects,
  finishedEffects,
  type RequestEffect,
} from "../../task-change-request/effects";
import {
  involvedPeople,
  loadConsentFacts,
} from "../../task-change-request/load-consent-facts";
import {
  consentError,
  openRequestWithEffects,
} from "../../task-change-request/request-change";
import type { ChangeRequestRow } from "../../task-change-request/response";
import { checkStatusChange } from "../../task-change-request/status-change";
import { statusWrite } from "../../task-change-request/apply-task-change";

async function updateTask(
  id: string,
  title: string,
  status: string,
  startDate: Date | undefined,
  dueDate: Date | undefined,
  projectId: string,
  description: string | undefined,
  priority: string,
  position: number,
  userId?: string,
  currentUserId?: string,
  actor: TaskActor = personActor(currentUserId ?? ""),
) {
  assertTaskPosition(position);

  let [existingTask] = await db
    .select({
      id: taskTable.id,
      title: taskTable.title,
      priority: taskTable.priority,
      userId: taskTable.userId,
      dueDate: taskTable.dueDate,
      description:
        description === undefined ? sql<null>`null` : taskTable.description,
      status: taskTable.status,
      position: taskTable.position,
      projectId: taskTable.projectId,
    })
    .from(taskTable)
    .where(eq(taskTable.id, id))
    .limit(1);

  if (!existingTask) {
    throw new HTTPException(404, {
      message: "Task not found",
    });
  }

  if (projectId !== existingTask.projectId) {
    throw new HTTPException(400, {
      message: "Use the task move endpoint to move tasks between projects",
    });
  }

  await assertValidTaskStatus(status, projectId);

  const normalizedUserId = userId?.trim() || undefined;

  if (normalizedUserId && normalizedUserId !== existingTask.userId) {
    await assertAssignableUser(
      normalizedUserId,
      await getProjectWorkspaceId(projectId),
      projectId,
    );
  }

  const column = await db.query.columnTable.findFirst({
    where: and(
      eq(columnTable.projectId, projectId),
      eq(columnTable.slug, status),
    ),
  });

  const initialPosition = existingTask.position;
  const initialStatus = existingTask.status;
  const effects: RequestEffect[] = [];
  let request: ChangeRequestRow | null = null;
  const updatedTask = await db.transaction(async (tx) => {
    const [project] = await tx
      .select({ id: projectTable.id })
      .from(projectTable)
      .where(eq(projectTable.id, projectId))
      .for("update");
    if (!project)
      throw new HTTPException(404, { message: "Project not found" });
    const [locked] = await tx
      .select({
        id: taskTable.id,
        title: taskTable.title,
        priority: taskTable.priority,
        userId: taskTable.userId,
        dueDate: taskTable.dueDate,
        description:
          description === undefined ? sql<null>`null` : taskTable.description,
        status: taskTable.status,
        columnId: taskTable.columnId,
        position: taskTable.position,
        projectId: taskTable.projectId,
        number: taskTable.number,
        createdBy: taskTable.createdBy,
        statusGeneration: taskTable.statusGeneration,
        startDate: taskTable.startDate,
      })
      .from(taskTable)
      .where(and(eq(taskTable.id, id), eq(taskTable.projectId, projectId)))
      .for("update");
    if (!locked)
      throw new HTTPException(409, {
        message: "Task changed projects; retry the update",
      });
    if (locked.position !== initialPosition || locked.status !== initialStatus)
      throw new HTTPException(409, {
        message: "Task order changed; refresh before updating",
      });
    existingTask = locked;

    // Consent is decided against the locked task as it was before this edit,
    // so an outsider cannot assign themselves and finish in one call.
    const statusChanges = status !== locked.status;
    let statusIsRequest = false;
    if (actor.kind === "person") {
      const facts = await loadConsentFacts(tx, locked, actor);
      if ((normalizedUserId ?? null) !== locked.userId) {
        const assign = decideConsent("assign", facts);
        if (assign.kind === "deny") throw consentError(assign);
      }
      if (statusChanges) {
        const consent = decideConsent("status", facts);
        if (consent.kind === "deny") throw consentError(consent);
        statusIsRequest = consent.kind === "request";
      }
      const edit = decideConsent("edit", facts);
      const fields = [
        title !== locked.title && "title",
        description !== undefined &&
          description !== locked.description &&
          "description",
        priority !== locked.priority && "priority",
        (dueDate?.getTime() ?? null) !== (locked.dueDate?.getTime() ?? null) &&
          "due date",
        (startDate?.getTime() ?? null) !==
          (locked.startDate?.getTime() ?? null) && "start date",
      ].filter((field): field is string => Boolean(field));
      if (edit.kind === "apply" && edit.notifyInvolved && fields.length)
        effects.push({
          type: "outsider_edit",
          taskId: id,
          projectId,
          taskTitle: title,
          actorId: actor.userId,
          involved: await involvedPeople(tx, locked),
          fields,
        });
      if (statusIsRequest) {
        const opened = await openRequestWithEffects(tx, {
          task: locked,
          workspaceId: facts.workspaceId,
          actor,
          kind: "status",
          targetStatus: status,
        });
        request = opened.request;
        effects.push(...opened.effects);
      }
    }
    // A new assignee changes who must consent: open requests no longer hold.
    if ((normalizedUserId ?? null) !== locked.userId)
      effects.push(
        ...finishedEffects(
          await cancelPendingRequests(tx, id, "task_changed"),
          currentUserId ?? null,
        ),
      );
    if (statusChanges && !statusIsRequest) {
      const check = await checkStatusChange(
        tx,
        locked,
        status,
        currentUserId ?? null,
      );
      if (!check.ok)
        throw new HTTPException(check.status, { message: check.message });
      effects.push(
        ...finishedEffects(
          await cancelPendingRequests(tx, id, "task_changed"),
          currentUserId ?? null,
        ),
      );
    }

    const [task] = await tx
      .update(taskTable)
      .set({
        title,
        ...(statusIsRequest
          ? {}
          : { ...statusWrite(status), columnId: column?.id ?? null }),
        startDate: startDate || null,
        dueDate: dueDate || null,
        projectId,
        description,
        priority,
        position,
        userId: normalizedUserId ?? null,
      })
      .where(and(eq(taskTable.id, id), eq(taskTable.projectId, projectId)))
      .returning({
        ...getTableColumns(taskTable),
        description: boardDescription,
        descriptionDeferred,
      });
    if (task)
      await recordTaskMutation(
        tx,
        existingTask,
        { title, dueDate: dueDate ?? null },
        currentUserId,
      );
    return task;
  });

  if (!updatedTask) {
    throw new HTTPException(500, {
      message: "Failed to update task",
    });
  }

  await dispatchRequestEffects(effects);

  await publishTaskMutation(
    {
      ...existingTask,
      description:
        description === undefined ? undefined : existingTask.description,
    },
    { ...updatedTask, description: description ?? updatedTask.description },
    currentUserId,
  );

  await publishEvent("task.updated", {
    taskId: updatedTask.id,
    projectId: updatedTask.projectId,
    title: updatedTask.title,
    status: updatedTask.status,
    userId: currentUserId,
  });

  // Fields other than status applied either way; a status the caller may not
  // set directly waits as a request, and the result says so.
  return request
    ? { outcome: "requested" as const, request, task: updatedTask }
    : { outcome: "applied" as const, task: updatedTask };
}

export default updateTask;
