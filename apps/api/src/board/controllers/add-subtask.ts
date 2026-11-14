import { and, eq, not } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { projectTable, taskTable } from "../../database/schema";
import { assertProjectAccess } from "../../project-access/assert-project-access";
import { isSubtask } from "../../task/is-subtask";
import createTask from "../../task/controllers/create-task";

/**
 * Create a task in a repo project and link it under a task, atomically:
 * the task and its subtask relation commit together or not at all.
 */
async function addSubtask({
  taskId,
  workspaceId,
  currentUserId,
  projectId,
  title,
  description,
  userId,
  status,
  priority,
}: {
  taskId: string;
  workspaceId: string;
  currentUserId: string;
  projectId: string;
  title: string;
  description?: string;
  userId?: string;
  status?: string;
  priority?: string;
}) {
  const [target] = await db
    .select({ id: projectTable.id })
    .from(projectTable)
    .where(
      and(
        eq(projectTable.id, projectId),
        eq(projectTable.workspaceId, workspaceId),
      ),
    )
    .limit(1);
  if (!target) {
    throw new HTTPException(404, {
      message: "Project not found in this workspace",
    });
  }
  await assertProjectAccess(currentUserId, projectId);

  // The parent must be a task on the board itself. A subtask cannot have
  // subtasks, so the board stays two levels deep.
  const [parent] = await db
    .select({ id: taskTable.id })
    .from(taskTable)
    .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
    .where(
      and(
        eq(taskTable.id, taskId),
        eq(projectTable.workspaceId, workspaceId),
        eq(projectTable.kind, "board"),
        not(isSubtask),
      ),
    )
    .limit(1);
  if (!parent) {
    throw new HTTPException(404, { message: "Board task not found" });
  }

  return createTask({
    projectId,
    currentUserId,
    userId,
    title,
    description,
    status: status ?? "to-do",
    priority: priority ?? "no-priority",
    parentTaskId: taskId,
  });
}

export default addSubtask;
