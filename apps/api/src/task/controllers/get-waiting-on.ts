import { and, asc, eq, inArray } from "drizzle-orm";
import db from "../../database";
import {
  projectTable,
  taskRelationTable,
  taskTable,
  userTable,
} from "../../database/schema";
import { taskIsOpen } from "../../board/open-board-task";
import { canSeeLinkedTask } from "../can-see-linked-task";
import { type LinkedTask, taskKey } from "../linked-task";

/**
 * For each given task, the open tasks it blocks that the caller can see: the
 * work that cannot move until this task is done. A finished or archived
 * blocked task no longer waits on anyone. A task in a repo the caller cannot
 * see is left out.
 */
export async function getWaitingOn(
  taskIds: string[],
  userId: string,
  workspaceId: string,
) {
  const waiting = new Map<string, LinkedTask[]>();
  if (taskIds.length === 0) return waiting;

  const rows = await db
    .select({
      blockerId: taskRelationTable.sourceTaskId,
      id: taskTable.id,
      title: taskTable.title,
      number: taskTable.number,
      slug: projectTable.slug,
      assigneeName: userTable.name,
    })
    .from(taskRelationTable)
    .innerJoin(taskTable, eq(taskTable.id, taskRelationTable.targetTaskId))
    .innerJoin(projectTable, eq(projectTable.id, taskTable.projectId))
    .leftJoin(userTable, eq(userTable.id, taskTable.userId))
    .where(
      and(
        eq(taskRelationTable.relationType, "blocks"),
        inArray(taskRelationTable.sourceTaskId, taskIds),
        eq(projectTable.workspaceId, workspaceId),
        canSeeLinkedTask(userId),
        taskIsOpen,
      ),
    )
    .orderBy(asc(taskTable.createdAt), asc(taskTable.id));

  for (const { blockerId, number, slug, ...row } of rows) {
    const list = waiting.get(blockerId) ?? [];
    list.push({ ...row, key: taskKey(slug, number) });
    waiting.set(blockerId, list);
  }
  return waiting;
}
