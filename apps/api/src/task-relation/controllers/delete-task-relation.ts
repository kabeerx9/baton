import { and, eq, inArray } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  projectTable,
  taskRelationTable,
  taskTable,
} from "../../database/schema";
import { publishEvent } from "../../events";
import { projectAccessCondition } from "../../project-access/project-access-condition";

async function deleteTaskRelation(
  id: string,
  userId: string,
  workspaceId: string,
) {
  const workspaceTasks = db
    .select({ id: taskTable.id })
    .from(taskTable)
    .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
    .where(
      and(
        eq(projectTable.workspaceId, workspaceId),
        projectAccessCondition(userId, taskTable.projectId),
      ),
    );

  // Check both endpoints in the delete statement itself: the caller must reach
  // both tasks in this workspace, the same boundary creation and reads enforce.
  const [relation] = await db
    .delete(taskRelationTable)
    .where(
      and(
        eq(taskRelationTable.id, id),
        inArray(taskRelationTable.sourceTaskId, workspaceTasks),
        inArray(taskRelationTable.targetTaskId, workspaceTasks),
      ),
    )
    .returning();

  if (!relation) {
    throw new HTTPException(404, {
      message: "Task relation not found",
    });
  }

  const endpoints = await db
    .select({ id: taskTable.id, projectId: taskTable.projectId })
    .from(taskTable)
    .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
    .where(
      and(
        inArray(taskTable.id, [relation.sourceTaskId, relation.targetTaskId]),
        eq(projectTable.workspaceId, workspaceId),
      ),
    );
  const task = endpoints.find((row) => row.id === relation.sourceTaskId);
  const target = endpoints.find((row) => row.id === relation.targetTaskId);

  if (task) {
    await publishEvent("task-relation.deleted", {
      ...relation,
      taskId: relation.sourceTaskId,
      projectId: task.projectId,
      sourceProjectId: task.projectId,
      targetProjectId: target?.projectId,
      userId,
    });
  }

  return relation;
}

export default deleteTaskRelation;
