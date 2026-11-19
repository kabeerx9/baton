import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { labelTable, projectTable, taskTable } from "../../database/schema";
import { publishEvent } from "../../events";
import { removeLabelFromGitHub } from "../../plugins/github/utils/sync-label-to-github";
import type { PersonActor } from "../../task-change-request/actor";
import { lockEditableTask } from "../../task-change-request/assert-may-edit";
import { logger } from "../../observability/logger";

/** `ownTaskOnly`: see `assignLabelToTask`. */
async function unassignLabelFromTask(
  id: string,
  userId: string,
  ownTaskOnly: PersonActor | null = null,
) {
  const label = await db.query.labelTable.findFirst({
    where: (label, { eq }) => eq(label.id, id),
  });

  if (!label) {
    throw new HTTPException(404, {
      message: "Label not found",
    });
  }

  if (!label.taskId) {
    throw new HTTPException(400, {
      message: "Label is not assigned to a task",
    });
  }

  const [task] = await db
    .select({
      id: taskTable.id,
      projectId: taskTable.projectId,
      workspaceId: projectTable.workspaceId,
    })
    .from(taskTable)
    .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
    .where(eq(taskTable.id, label.taskId))
    .limit(1);

  if (!task || task.workspaceId !== label.workspaceId) {
    throw new HTTPException(404, {
      message: "Task not found",
    });
  }

  const labelTaskId = label.taskId;
  const [deletedLabel] = await db.transaction(async (tx) => {
    if (ownTaskOnly)
      await lockEditableTask(tx, labelTaskId, ownTaskOnly, {
        assignedOnly: true,
      });
    return tx
      .delete(labelTable)
      .where(
        ownTaskOnly
          ? and(eq(labelTable.id, id), eq(labelTable.taskId, labelTaskId))
          : eq(labelTable.id, id),
      )
      .returning();
  });

  if (!deletedLabel) {
    throw new HTTPException(500, {
      message: "Failed to detach label from task",
    });
  }

  if (deletedLabel.taskId) {
    removeLabelFromGitHub(deletedLabel.taskId, deletedLabel.name).catch(
      (error) => {
        logger.error("Failed to remove label from GitHub", { error });
      },
    );
  }

  await publishEvent("task.label_unassigned", {
    label: deletedLabel,
    task,
    projectId: task.projectId,
    taskId: deletedLabel.taskId,
    userId,
    type: "label_unassigned",
  });

  return deletedLabel;
}

export default unassignLabelFromTask;
