import { and, asc, eq, inArray, sql } from "drizzle-orm";
import db from "../database";
import {
  projectTable,
  taskRelationTable,
  taskTable,
  userTable,
} from "../database/schema";
import { taskIsOpen } from "../board/open-board-task";
import { canSeeLinkedTask } from "./can-see-linked-task";
import { type BlockLink, summarizeBlockers } from "./summarize-blockers";

/**
 * Every `blocks` link into the given tasks, in one query, whatever the
 * blocker's status or repo. Each row says whether the blocker is open and
 * whether the caller may see it. The board also derives its map edges from
 * these rows, so it reads the links once.
 */
export async function loadBlockLinks(
  targetIds: string[],
  userId: string,
  workspaceId: string,
): Promise<BlockLink[]> {
  if (targetIds.length === 0) return [];
  return db
    .select({
      blockedId: taskRelationTable.targetTaskId,
      blockerId: taskRelationTable.sourceTaskId,
      isOpen: sql<boolean>`${taskIsOpen}`,
      visible: sql<boolean>`(${projectTable.workspaceId} = ${workspaceId} and ${canSeeLinkedTask(userId)})`,
      title: taskTable.title,
      number: taskTable.number,
      slug: projectTable.slug,
      assigneeName: userTable.name,
    })
    .from(taskRelationTable)
    .innerJoin(taskTable, eq(taskTable.id, taskRelationTable.sourceTaskId))
    .innerJoin(projectTable, eq(projectTable.id, taskTable.projectId))
    .leftJoin(userTable, eq(userTable.id, taskTable.userId))
    .where(
      and(
        eq(taskRelationTable.relationType, "blocks"),
        inArray(taskRelationTable.targetTaskId, targetIds),
      ),
    )
    .orderBy(asc(taskTable.createdAt), asc(taskTable.id));
}

/**
 * What each given open task waits on: the open blockers the caller can see,
 * and a count of the ones they cannot. Pass open tasks only.
 */
export async function getOpenBlockers(
  openTaskIds: string[],
  userId: string,
  workspaceId: string,
) {
  const links = await loadBlockLinks(openTaskIds, userId, workspaceId);
  return summarizeBlockers(links, new Set(openTaskIds));
}
