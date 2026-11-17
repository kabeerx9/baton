import { and, eq, not, sql } from "drizzle-orm";
import {
  projectTable,
  taskRelationTable,
  taskTable,
} from "../../database/schema";
import type { DbOrTx } from "../../project-access/db-or-tx";
import { projectAccessCondition } from "../../project-access/project-access-condition";
import { finishedAt } from "../../task/finished-at";
import { isSubtask } from "../../task/is-subtask";
import { taskIsCompleted } from "../../task/task-is-completed";

/**
 * Which top-level board items the board sends, decided in SQL so old done
 * trees never leave the database. It mirrors `boardColumn` and
 * `featureFinishedAt` over the subtasks the caller can see (same workspace
 * and project access, no archive filter, as the payload reads them):
 * an item is done when it has no visible subtask and is completed, or when
 * every visible subtask is completed; it finished when it did, or when its
 * last visible subtask did. A done item is kept when it finished at or after
 * `doneSince`, or has no finish time. `olderDoneCount` counts the rest.
 * Each done row still reads `activity` for its finish time (index
 * `activity_task_id_idx`); a stored finish time is the later scale step.
 */
export async function selectBoardWindow(
  database: DbOrTx,
  {
    workspaceId,
    boardProjectId,
    userId,
    doneSince,
  }: {
    workspaceId: string;
    boardProjectId: string;
    userId: string;
    doneSince: Date;
  },
) {
  const cutoff = sql`${doneSince.toISOString()}::timestamp`;

  // Here the joined `task` row is the subtask.
  const kids = database.$with("board_kids").as(
    database
      .select({
        parentId: sql<string>`${taskRelationTable.sourceTaskId}`.as(
          "parent_id",
        ),
        visible: sql<number>`count(*)::int`.as("visible"),
        open: sql<number>`(count(*) filter (where not ${taskIsCompleted}))::int`.as(
          "open",
        ),
        lastFinished:
          sql<Date | null>`max(case when ${taskIsCompleted} then ${finishedAt} end)`.as(
            "last_finished",
          ),
      })
      .from(taskRelationTable)
      .innerJoin(taskTable, eq(taskTable.id, taskRelationTable.targetTaskId))
      .innerJoin(projectTable, eq(projectTable.id, taskTable.projectId))
      .where(
        and(
          eq(taskRelationTable.relationType, "subtask"),
          eq(projectTable.workspaceId, workspaceId),
          projectAccessCondition(userId, projectTable.id),
        ),
      )
      .groupBy(taskRelationTable.sourceTaskId),
  );

  // Here the `task` row is the top-level board item.
  const items = database.$with("board_items").as(
    database
      .with(kids)
      .select({
        id: taskTable.id,
        number: taskTable.number,
        keep: sql<boolean>`(case
          when coalesce(${kids.visible}, 0) = 0
            then not ${taskIsCompleted} or ${finishedAt} >= ${cutoff}
          else ${kids.open} > 0
            or ${kids.lastFinished} is null
            or ${kids.lastFinished} >= ${cutoff}
        end)`.as("keep"),
      })
      .from(taskTable)
      .leftJoin(kids, eq(kids.parentId, taskTable.id))
      .where(and(eq(taskTable.projectId, boardProjectId), not(isSubtask))),
  );

  const [row] = await database
    .with(items)
    .select({
      ids: sql<
        string[]
      >`coalesce(array_agg(${items.id} order by ${items.number}) filter (where ${items.keep}), '{}')`,
      olderDoneCount: sql<number>`(count(*) filter (where not ${items.keep}))::int`,
    })
    .from(items);
  return { ids: row?.ids ?? [], olderDoneCount: row?.olderDoneCount ?? 0 };
}
