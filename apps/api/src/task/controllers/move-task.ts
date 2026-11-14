import { and, asc, eq, isNotNull, notInArray } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import createActivities from "../../activity/controllers/create-activities";
import db from "../../database";
import {
  assetTable,
  columnTable,
  externalLinkTable,
  integrationTable,
  projectTable,
  taskTable,
} from "../../database/schema";
import { publishEvent } from "../../events";
import { assertProjectAccess } from "../../project-access/assert-project-access";
import { filterUsersWithProjectAccess } from "../../project-access/filter-users-with-project-access";
import { claimTaskNumber } from "./claim-task-numbers";
import { nextTaskPosition } from "./next-task-position";
import { lockTask } from "./with-locked-task";
import { findBlockedMessage } from "../assert-not-blocked";
import { personActor, type TaskActor } from "../../task-change-request/actor";
import { cancelPendingRequests } from "../../task-change-request/cancel-pending";
import { decideConsent } from "../../task-change-request/consent";
import {
  dispatchRequestEffects,
  finishedEffects,
  type RequestEffect,
} from "../../task-change-request/effects";
import { loadConsentFacts } from "../../task-change-request/load-consent-facts";
import {
  consentError,
  NOT_INVOLVED_MESSAGE,
} from "../../task-change-request/request-change";

function isSameProjectMove(
  sourceProjectId: string,
  destinationProjectId: string,
) {
  return sourceProjectId === destinationProjectId;
}

async function resolveDestinationStatus(
  destinationProjectId: string,
  currentStatus: string,
  requestedStatus?: string,
) {
  const destinationColumns = await db
    .select({
      id: columnTable.id,
      slug: columnTable.slug,
      position: columnTable.position,
      isFinal: columnTable.isFinal,
    })
    .from(columnTable)
    .where(eq(columnTable.projectId, destinationProjectId))
    .orderBy(asc(columnTable.position));

  const [firstColumn] = destinationColumns;

  if (!firstColumn) {
    throw new HTTPException(400, {
      message: "Destination project does not have a workflow",
    });
  }

  const requestedColumn = requestedStatus
    ? destinationColumns.find((column) => column.slug === requestedStatus)
    : null;

  if (requestedStatus && !requestedColumn) {
    throw new HTTPException(400, {
      message: "Selected status is not valid for the destination project",
    });
  }

  const matchingCurrentColumn = destinationColumns.find(
    (column) => column.slug === currentStatus,
  );

  return requestedColumn ?? matchingCurrentColumn ?? firstColumn;
}

async function moveTask({
  taskId,
  destinationProjectId,
  destinationStatus,
  currentUserId,
  actor = personActor(currentUserId),
}: {
  taskId: string;
  destinationProjectId: string;
  destinationStatus?: string;
  currentUserId: string;
  actor?: TaskActor;
}) {
  const existingTask = await db.query.taskTable.findFirst({
    where: eq(taskTable.id, taskId),
  });

  if (!existingTask) {
    throw new HTTPException(404, {
      message: "Task not found",
    });
  }

  if (isSameProjectMove(existingTask.projectId, destinationProjectId)) {
    throw new HTTPException(400, {
      message: "Task is already in that project",
    });
  }

  const sourceProject = await db.query.projectTable.findFirst({
    where: eq(projectTable.id, existingTask.projectId),
  });
  if (!sourceProject) {
    throw new HTTPException(404, {
      message: "Project not found",
    });
  }

  const destinationProject = await db.query.projectTable.findFirst({
    where: and(
      eq(projectTable.id, destinationProjectId),
      eq(projectTable.workspaceId, sourceProject.workspaceId),
    ),
  });
  if (!destinationProject) {
    throw new HTTPException(404, {
      message: "Project not found",
    });
  }

  await assertProjectAccess(currentUserId, destinationProjectId);

  const resolvedColumn = await resolveDestinationStatus(
    destinationProjectId,
    existingTask.status,
    destinationStatus,
  );

  const effects: RequestEffect[] = [];
  const movedTask = await db.transaction(async (tx) => {
    for (const projectId of [sourceProject.id, destinationProjectId].sort()) {
      const [project] = await tx
        .select({ id: projectTable.id })
        .from(projectTable)
        .where(
          and(
            eq(projectTable.id, projectId),
            eq(projectTable.workspaceId, sourceProject.workspaceId),
          ),
        )
        .for("key share");
      if (!project)
        throw new HTTPException(409, {
          message: "Project was moved to another workspace, please try again",
        });
    }
    // Lock order: projects, then the task.
    const locked = await lockTask(tx, taskId);
    if (!locked || locked.projectId !== sourceProject.id)
      throw new HTTPException(409, {
        message: "Task was moved concurrently, please try again",
      });
    const statusChanges = resolvedColumn.slug !== locked.status;
    const dropsAssignee =
      locked.userId !== null &&
      !(
        await filterUsersWithProjectAccess(
          [locked.userId],
          destinationProjectId,
          tx,
        )
      ).has(locked.userId);
    // A move cannot carry a deferred request, so an outsider's move that
    // would change the status or drop the assignee is refused outright.
    if (actor.kind === "person" && (statusChanges || dropsAssignee)) {
      const facts = await loadConsentFacts(tx, locked, actor);
      if (statusChanges) {
        const consent = decideConsent("status", facts);
        if (consent.kind === "deny") throw consentError(consent);
        if (consent.kind === "request")
          throw new HTTPException(409, { message: NOT_INVOLVED_MESSAGE });
      }
      if (dropsAssignee) {
        const consent = decideConsent("assign", facts);
        if (consent.kind === "deny") throw consentError(consent);
      }
    }
    if (statusChanges && resolvedColumn.isFinal) {
      const blocked = await findBlockedMessage(tx, taskId, currentUserId);
      if (blocked) throw new HTTPException(409, { message: blocked });
    }
    effects.push(
      ...finishedEffects(
        await cancelPendingRequests(tx, taskId, "task_changed"),
        currentUserId,
      ),
    );
    const nextTaskNumber = await claimTaskNumber(destinationProjectId, tx);
    const nextPosition = await nextTaskPosition(
      tx,
      destinationProjectId,
      resolvedColumn.slug,
      resolvedColumn.id,
    );

    const [updatedTask] = await tx
      .update(taskTable)
      .set({
        projectId: destinationProjectId,
        status: resolvedColumn.slug,
        columnId: resolvedColumn.id,
        number: nextTaskNumber,
        position: nextPosition,
      })
      .where(
        and(
          eq(taskTable.id, taskId),
          eq(taskTable.projectId, sourceProject.id),
        ),
      )
      .returning();

    if (!updatedTask) {
      throw new HTTPException(409, {
        message: "Task was moved concurrently, please try again",
      });
    }

    let movedTask = updatedTask;
    const assigneeId = updatedTask.userId;
    if (
      assigneeId &&
      !(
        await filterUsersWithProjectAccess(
          [assigneeId],
          destinationProjectId,
          tx,
        )
      ).has(assigneeId)
    ) {
      const [unassignedTask] = await tx
        .update(taskTable)
        .set({ userId: null })
        .where(eq(taskTable.id, taskId))
        .returning();
      movedTask = unassignedTask ?? { ...updatedTask, userId: null };
      await createActivities(
        [
          {
            taskId,
            type: "unassigned",
            userId: currentUserId,
            content: null,
            eventData: {},
          },
        ],
        tx,
      );
    }

    await tx
      .delete(externalLinkTable)
      .where(
        and(
          eq(externalLinkTable.taskId, taskId),
          isNotNull(externalLinkTable.integrationId),
          notInArray(
            externalLinkTable.integrationId,
            tx
              .select({ id: integrationTable.id })
              .from(integrationTable)
              .where(eq(integrationTable.projectId, destinationProjectId)),
          ),
        ),
      );

    await tx
      .update(assetTable)
      .set({ projectId: destinationProjectId })
      .where(eq(assetTable.taskId, taskId));

    return movedTask;
  });

  await dispatchRequestEffects(effects);
  await publishEvent("task.moved", {
    taskId,
    type: "moved",
    userId: currentUserId,
    fromProjectId: sourceProject.id,
    fromProjectName: sourceProject.name,
    toProjectId: destinationProject.id,
    toProjectName: destinationProject.name,
    oldStatus: existingTask.status,
    newStatus: resolvedColumn.slug,
  });

  return {
    task: movedTask,
    sourceProjectId: sourceProject.id,
    destinationProjectId: destinationProject.id,
  };
}

export default moveTask;
