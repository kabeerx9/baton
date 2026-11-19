import { createId } from "@paralleldrive/cuid2";
import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { validationError } from "../../errors/validation-error";
import { taskTitle } from "../task-title";
import db from "../../database";
import {
  assetTable,
  columnTable,
  labelTable,
  projectTable,
  taskRelationTable,
  taskTable,
  userTable,
} from "../../database/schema";
import { publishEvent } from "../../events";
import { projectAccessCondition } from "../../project-access/project-access-condition";
import { contentReferencesAsset } from "../../storage/cleanup-assets";
import { copyTaskAssetObject, deleteS3Object } from "../../storage/s3";
import { filterUsersWithProjectAccess } from "../../project-access/filter-users-with-project-access";
import {
  filterAssignableUsers,
  NOT_ASSIGNABLE,
} from "../../utils/assert-assignable-user";
import { assertValidTaskStatus } from "../validate-task-fields";
import { claimTaskNumber } from "./claim-task-numbers";
import { nextTaskPosition } from "./next-task-position";
import { logger } from "../../observability/logger";

async function discardCopiedObjects(objectKeys: string[]) {
  await Promise.all(
    objectKeys.map((objectKey) =>
      deleteS3Object(objectKey).catch((error) => {
        logger.error("Failed to discard a duplicated task asset", { error });
      }),
    ),
  );
}

// Assets are addressed by `/api/asset/<id>` inside the description, so the copy
// needs its own asset rows and stored objects. Sharing the source rows is not an
// option: `asset.objectKey` is unique and deleting the source task cascades to them.
async function duplicateDescriptionAssets({
  sourceTask,
  duplicatedTaskId,
  workspaceId,
}: {
  sourceTask: typeof taskTable.$inferSelect;
  duplicatedTaskId: string;
  workspaceId: string;
}) {
  const description = sourceTask.description;

  if (!description) {
    return { assets: [], description };
  }

  const sourceAssets = await db
    .select()
    .from(assetTable)
    .where(
      and(
        eq(assetTable.taskId, sourceTask.id),
        eq(assetTable.projectId, sourceTask.projectId),
        eq(assetTable.workspaceId, workspaceId),
      ),
    );

  const referencedAssets = sourceAssets.filter((asset) =>
    contentReferencesAsset(description, asset.id),
  );

  const assets: (typeof assetTable.$inferInsert)[] = [];
  let duplicatedDescription = description;

  try {
    for (const asset of referencedAssets) {
      const duplicatedAssetId = createId();
      const objectKey = await copyTaskAssetObject({
        sourceKey: asset.objectKey,
        destination: {
          workspaceId,
          projectId: sourceTask.projectId,
          taskId: duplicatedTaskId,
          surface: asset.surface === "comment" ? "comment" : "description",
          filename: asset.filename,
          contentType: asset.mimeType,
        },
      });

      assets.push({
        id: duplicatedAssetId,
        workspaceId,
        projectId: sourceTask.projectId,
        taskId: duplicatedTaskId,
        objectKey,
        filename: asset.filename,
        mimeType: asset.mimeType,
        size: asset.size,
        kind: asset.kind,
        surface: asset.surface,
        createdBy: asset.createdBy,
      });

      duplicatedDescription = duplicatedDescription.replaceAll(
        `/api/asset/${asset.id}`,
        `/api/asset/${duplicatedAssetId}`,
      );
    }
  } catch (error) {
    await discardCopiedObjects(assets.map((asset) => asset.objectKey));

    logger.error("Failed to copy task attachments", { error });
    throw new HTTPException(503, {
      message: "Failed to copy the task attachments",
    });
  }

  return { assets, description: duplicatedDescription };
}

type DuplicateTaskOptions = {
  taskId: string;
  currentUserId: string;
  canUpdateTasks: boolean;
  title?: string;
};

type DuplicatedTask = typeof taskTable.$inferSelect & {
  assigneeName: string | undefined;
};

async function duplicateTask({
  taskId,
  currentUserId,
  canUpdateTasks,
  title,
}: DuplicateTaskOptions): Promise<DuplicatedTask> {
  const sourceTask = await db.query.taskTable.findFirst({
    where: eq(taskTable.id, taskId),
  });

  if (!sourceTask) {
    throw new HTTPException(404, {
      message: "Task not found",
    });
  }

  // The copy obeys the title rule even when the title comes from the source,
  // checked before any asset is copied.
  const parsedTitle = taskTitle.safeParse(title ?? sourceTask.title);
  if (!parsedTitle.success) {
    throw validationError(
      parsedTitle.error.issues.map((issue) => ({
        ...issue,
        path: ["title", ...issue.path],
      })),
    );
  }
  const copyTitle = parsedTitle.data;

  const [project] = await db
    .select({ workspaceId: projectTable.workspaceId })
    .from(projectTable)
    .where(eq(projectTable.id, sourceTask.projectId))
    .limit(1);

  if (!project) {
    throw new HTTPException(404, {
      message: "Project not found",
    });
  }

  const status = sourceTask.status;
  await assertValidTaskStatus(status, sourceTask.projectId);
  // A copy reports a departed assignee.
  let userId = sourceTask.userId;
  if (userId) {
    const members = await filterAssignableUsers([userId], project.workspaceId);
    if (!members.has(userId)) {
      throw new HTTPException(403, { message: NOT_ASSIGNABLE });
    }
  }
  if (userId) {
    const permitted = await filterUsersWithProjectAccess(
      [userId],
      sourceTask.projectId,
    );
    if (!permitted.has(userId)) userId = null;
  }
  const column = await db.query.columnTable.findFirst({
    where: and(
      eq(columnTable.projectId, sourceTask.projectId),
      eq(columnTable.slug, status),
    ),
  });

  const sourceLabels = await db
    .select({
      name: labelTable.name,
      color: labelTable.color,
      workspaceId: labelTable.workspaceId,
    })
    .from(labelTable)
    .where(
      and(
        eq(labelTable.taskId, sourceTask.id),
        eq(labelTable.workspaceId, project.workspaceId),
      ),
    );

  // A duplicated subtask stays a subtask of the same parents. The source's own
  // subtasks are not duplicated: a copy is one task, not a tree.
  const parentRelations = await db
    .select({
      parentTaskId: taskRelationTable.sourceTaskId,
      parentProjectId: taskTable.projectId,
      relationType: taskRelationTable.relationType,
    })
    .from(taskRelationTable)
    .innerJoin(taskTable, eq(taskRelationTable.sourceTaskId, taskTable.id))
    .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
    .where(
      and(
        eq(taskRelationTable.targetTaskId, sourceTask.id),
        eq(projectTable.workspaceId, project.workspaceId),
        eq(taskRelationTable.relationType, "subtask"),
        projectAccessCondition(currentUserId, taskTable.projectId),
      ),
    );

  if (parentRelations.length > 0 && !canUpdateTasks) {
    throw new HTTPException(403, {
      message: "Duplicating parent links requires task:update permission",
    });
  }

  // The destination object keys embed the new task id, so it is generated up front
  // instead of being left to the insert.
  const duplicatedTaskId = createId();

  const { assets, description } = await duplicateDescriptionAssets({
    sourceTask,
    duplicatedTaskId,
    workspaceId: project.workspaceId,
  });

  let duplicated: {
    task: typeof taskTable.$inferSelect;
    relations: (typeof taskRelationTable.$inferSelect)[];
  };

  try {
    duplicated = await db.transaction(async (tx) => {
      // Locks the project row before the task row, the same order task updates
      // use.
      const taskNumber = await claimTaskNumber(sourceTask.projectId, tx);

      const nextPosition = await nextTaskPosition(
        tx,
        sourceTask.projectId,
        status,
        column?.id ?? null,
      );

      const [task] = await tx
        .insert(taskTable)
        .values({
          id: duplicatedTaskId,
          projectId: sourceTask.projectId,
          userId,
          // The person duplicating creates the copy; never the source's creator.
          createdBy: currentUserId || null,
          title: copyTitle,
          status,
          columnId: column?.id ?? null,
          startDate: sourceTask.startDate,
          dueDate: sourceTask.dueDate,
          description,
          priority: sourceTask.priority,
          number: taskNumber,
          position: nextPosition,
        })
        .returning();

      if (!task) {
        throw new HTTPException(500, {
          message: "Failed to duplicate task",
        });
      }

      if (sourceLabels.length > 0) {
        await tx.insert(labelTable).values(
          sourceLabels.map((label) => ({
            name: label.name,
            color: label.color,
            taskId: task.id,
            workspaceId: label.workspaceId,
          })),
        );
      }

      if (assets.length > 0) {
        await tx.insert(assetTable).values(assets);
      }

      const relations =
        parentRelations.length > 0
          ? await tx
              .insert(taskRelationTable)
              .values(
                parentRelations.map((relation) => ({
                  sourceTaskId: relation.parentTaskId,
                  targetTaskId: task.id,
                  relationType: relation.relationType,
                })),
              )
              .returning()
          : [];

      return { task, relations };
    });
  } catch (error) {
    await discardCopiedObjects(assets.map((asset) => asset.objectKey));
    throw error;
  }

  const duplicatedTask = duplicated.task;

  const [assignee] = duplicatedTask.userId
    ? await db
        .select({ name: userTable.name })
        .from(userTable)
        .where(eq(userTable.id, duplicatedTask.userId))
    : [];

  await publishEvent("task.created", {
    ...duplicatedTask,
    taskId: duplicatedTask.id,
    userId: duplicatedTask.userId ?? "",
    currentUserId,
    type: "created",
    content: null,
  });

  for (const relation of duplicated.relations) {
    const parentProjectId = parentRelations.find(
      (parentRelation) => parentRelation.parentTaskId === relation.sourceTaskId,
    )?.parentProjectId;

    await publishEvent("task-relation.created", {
      ...relation,
      taskId: relation.sourceTaskId,
      projectId: parentProjectId ?? sourceTask.projectId,
      sourceProjectId: parentProjectId,
      targetProjectId: sourceTask.projectId,
      userId: currentUserId,
    });
  }

  return {
    ...duplicatedTask,
    assigneeName: assignee?.name,
  };
}

export default duplicateTask;
