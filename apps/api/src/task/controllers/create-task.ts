import { cancelPendingRequests } from "../../task-change-request/cancel-pending";
import { extractAssetIds } from "../../storage/cleanup-assets";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  assetTable,
  columnTable,
  taskRelationTable,
  taskTable,
  projectTable,
  userTable,
} from "../../database/schema";
import { publishEvent } from "../../events";
import {
  assertAssignableUser,
  getProjectWorkspaceId,
} from "../../utils/assert-assignable-user";
import { assertValidTaskStatus } from "../validate-task-fields";
import { claimTaskNumber } from "./claim-task-numbers";
import { nextTaskPosition } from "./next-task-position";

async function createTask({
  projectId,
  currentUserId,
  userId,
  title,
  status,
  startDate,
  dueDate,
  description,
  priority,
  draftAssetIds,
  parentTaskId,
}: {
  /** Links the new task as a subtask of this task in the same transaction. */
  parentTaskId?: string;
  projectId: string;
  currentUserId: string;
  userId?: string;
  title: string;
  status: string;
  startDate?: Date;
  dueDate?: Date;
  description?: string;
  priority?: string;
  draftAssetIds?: string[];
}) {
  const resolvedStatus = status || "to-do";
  const resolvedPriority = priority || "no-priority";

  const normalizedUserId = userId?.trim() || undefined;

  await assertValidTaskStatus(resolvedStatus, projectId);

  let assignee: { name: string } | undefined;

  if (normalizedUserId) {
    await assertAssignableUser(
      normalizedUserId,
      await getProjectWorkspaceId(projectId),
      projectId,
    );

    [assignee] = await db
      .select({ name: userTable.name })
      .from(userTable)
      .where(eq(userTable.id, normalizedUserId));
  }

  const column = await db.query.columnTable.findFirst({
    where: and(
      eq(columnTable.projectId, projectId),
      eq(columnTable.slug, resolvedStatus),
    ),
  });

  const createdTask = await db.transaction(async (tx) => {
    const taskNumber = await claimTaskNumber(projectId, tx);
    const nextPosition = await nextTaskPosition(
      tx,
      projectId,
      resolvedStatus,
      column?.id ?? null,
    );

    const [task] = await tx
      .insert(taskTable)
      .values({
        projectId,
        userId: normalizedUserId ?? null,
        createdBy: currentUserId || null,
        title: title || "",
        status: resolvedStatus,
        columnId: column?.id ?? null,
        startDate: startDate || null,
        dueDate: dueDate || null,
        description: description || "",
        priority: resolvedPriority,
        number: taskNumber,
        position: nextPosition,
      })
      .returning();

    if (task && draftAssetIds?.length) {
      const referenced = extractAssetIds(description);
      const ids = [...new Set(draftAssetIds)].filter((id) =>
        referenced.has(id),
      );
      if (ids.length) {
        // claimTaskNumber already holds the project row lock in this transaction.
        const project = await tx.query.projectTable.findFirst({
          columns: { workspaceId: true },
          where: eq(projectTable.id, projectId),
        });
        if (!project)
          throw new HTTPException(404, { message: "Project not found" });
        const claimed = await tx
          .update(assetTable)
          .set({
            taskId: task.id,
            surface: "description",
            workspaceId: project.workspaceId,
          })
          .where(
            and(
              inArray(assetTable.id, ids),
              eq(assetTable.projectId, projectId),
              eq(assetTable.createdBy, currentUserId),
              eq(assetTable.surface, "draft"),
              isNull(assetTable.taskId),
            ),
          )
          .returning({ id: assetTable.id });
        if (claimed.length !== ids.length)
          throw new HTTPException(400, {
            message:
              "Some staged uploads are unavailable or belong to another owner/project",
          });
      }
    }

    if (task && parentTaskId) {
      await tx.insert(taskRelationTable).values({
        sourceTaskId: parentTaskId,
        targetTaskId: task.id,
        relationType: "subtask",
      });
      // The parent is now a feature; its own status no longer counts.
      await cancelPendingRequests(tx, parentTaskId, "became_feature");
    }

    return task;
  });

  if (!createdTask) {
    throw new HTTPException(500, {
      message: "Failed to create task",
    });
  }

  await publishEvent("task.created", {
    ...createdTask,
    taskId: createdTask.id,
    userId: createdTask.userId ?? "",
    currentUserId: currentUserId,
    type: "created",
    content: null,
  });

  if (parentTaskId) {
    await publishEvent("task-relation.created", {
      sourceTaskId: parentTaskId,
      targetTaskId: createdTask.id,
      relationType: "subtask",
      taskId: parentTaskId,
      projectId,
      userId: currentUserId,
    });
  }

  return {
    ...createdTask,
    assigneeName: assignee?.name,
  };
}

export default createTask;
