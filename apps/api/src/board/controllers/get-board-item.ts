import { and, eq, not, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import {
  projectTable,
  taskRelationTable,
  taskTable,
} from "../../database/schema";
import type { DbOrTx } from "../../project-access/db-or-tx";
import { projectAccessCondition } from "../../project-access/project-access-condition";
import { pendingRequestsForTasks } from "../../task-change-request/pending-summaries";
import { isSubtask } from "../../task/is-subtask";
import { parseTaskRef, taskNotFound } from "../resolve-names";
import { boardSnapshot } from "./board-snapshot";
import { ensureBoardProject } from "./ensure-board-project";
import { getVisibleProjects } from "./get-visible-projects";
import { type BoardViewer, loadBoardItems } from "./load-board-items";

/**
 * A task of this workspace by key (API-3) or id, only when the caller can see
 * it as the board does: a top-level board task is visible to every member,
 * anything else follows project access. A hidden task answers exactly as a
 * missing one, so its key reveals nothing, not even its parent.
 */
async function findVisibleTask(
  database: DbOrTx,
  workspaceId: string,
  userId: string,
  ref: string,
) {
  const parsed = parseTaskRef(ref);
  const [task] = await database
    .select({ id: taskTable.id, projectId: taskTable.projectId })
    .from(taskTable)
    .innerJoin(projectTable, eq(projectTable.id, taskTable.projectId))
    .where(
      and(
        eq(projectTable.workspaceId, workspaceId),
        "id" in parsed
          ? eq(taskTable.id, parsed.id)
          : and(
              sql`lower(${projectTable.slug}) = ${parsed.slug.toLowerCase()}`,
              eq(taskTable.number, parsed.number),
            ),
        or(
          and(eq(projectTable.kind, "board"), not(isSubtask)),
          projectAccessCondition(userId, projectTable.id),
        ),
      ),
    )
    .limit(1);
  if (!task) throw taskNotFound(parsed.key);
  return task;
}

/**
 * The top-level board item that is, or holds, the task; null when none.
 * Subtask parents are top-level board tasks (the board is two levels deep).
 */
async function boardItemIdOf(
  database: DbOrTx,
  task: { id: string; projectId: string },
  boardProjectId: string,
) {
  const parent = alias(taskTable, "board_parent");
  const [link] = await database
    .select({ id: parent.id, projectId: parent.projectId })
    .from(taskRelationTable)
    .innerJoin(parent, eq(parent.id, taskRelationTable.sourceTaskId))
    .where(
      and(
        eq(taskRelationTable.targetTaskId, task.id),
        eq(taskRelationTable.relationType, "subtask"),
      ),
    )
    .limit(1);
  if (link) return link.projectId === boardProjectId ? link.id : null;
  return task.projectId === boardProjectId ? task.id : null;
}

/**
 * One board item with no done window: the top-level item that is the task,
 * or the feature that holds it, built as the board builds it. `null` for a
 * repo task outside any feature.
 */
export async function getBoardItem(
  workspaceId: string,
  viewer: BoardViewer,
  key: string,
) {
  const { id: boardProjectId } = await ensureBoardProject(workspaceId);
  return boardSnapshot(async (tx) => {
    const task = await findVisibleTask(tx, workspaceId, viewer.userId, key);
    const itemId = await boardItemIdOf(tx, task, boardProjectId);
    if (!itemId) return { task: null };
    const projects = await getVisibleProjects(tx, workspaceId, viewer.userId);
    const [item] = await loadBoardItems(tx, {
      workspaceId,
      boardProjectId,
      viewer,
      projects,
      taskIds: [itemId],
      loadPending: (ids) => pendingRequestsForTasks(ids, tx),
    });
    return { task: item ?? null };
  });
}
