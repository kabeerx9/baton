import { and, eq, isNotNull, isNull, not, sql } from "drizzle-orm";
import db from "../../database";
import { projectTable, taskTable, userTable } from "../../database/schema";
import { projectAccessCondition } from "../../project-access/project-access-condition";
import { finishedAt } from "../../task/finished-at";
import { taskIsCompleted } from "../../task/task-is-completed";
import { hasOpenSubtask, isBoardParent } from "../open-board-task";
import { summarizeHistory } from "./summarize-history";

/**
 * Who finished what, for the team history page.
 * One unit of work is a subtask, or a board task that has no subtasks. A board
 * task with subtasks is not counted itself, so nothing is counted twice.
 * Work is credited to the task's current assignee.
 */
async function getTeamHistory(
  workspaceId: string,
  userId: string,
  days: number,
) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const inWorkspace = and(
    eq(projectTable.workspaceId, workspaceId),
    isNull(projectTable.archivedAt),
    isNotNull(taskTable.userId),
    projectAccessCondition(userId, projectTable.id),
  );

  const [finished, open] = await Promise.all([
    db
      .select({
        id: taskTable.id,
        title: taskTable.title,
        number: taskTable.number,
        projectId: projectTable.id,
        projectSlug: projectTable.slug,
        projectName: projectTable.name,
        projectKind: projectTable.kind,
        userId: userTable.id,
        userName: userTable.name,
        userImage: userTable.image,
        finishedAt,
      })
      .from(taskTable)
      .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
      .innerJoin(userTable, eq(taskTable.userId, userTable.id))
      .where(
        and(
          inWorkspace,
          taskIsCompleted,
          not(isBoardParent),
          sql`${finishedAt} >= ${since.toISOString()}::timestamp`,
        ),
      )
      .orderBy(sql`${finishedAt} desc`),
    db
      .select({
        userId: userTable.id,
        userName: userTable.name,
        userImage: userTable.image,
        open: sql<number>`count(*)::int`,
      })
      .from(taskTable)
      .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
      .innerJoin(userTable, eq(taskTable.userId, userTable.id))
      .where(
        and(
          inWorkspace,
          sql`case when ${isBoardParent} then ${hasOpenSubtask} else not ${taskIsCompleted} end`,
        ),
      )
      .groupBy(userTable.id, userTable.name, userTable.image),
  ]);

  return { since, days, ...summarizeHistory(finished, open) };
}

export default getTeamHistory;
