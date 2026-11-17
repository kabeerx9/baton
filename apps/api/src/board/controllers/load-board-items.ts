import { and, asc, eq, inArray, sql } from "drizzle-orm";
import {
  externalLinkTable,
  projectTable,
  taskRelationTable,
  taskTable,
  userTable,
} from "../../database/schema";
import type { DbOrTx } from "../../project-access/db-or-tx";
import { projectAccessCondition } from "../../project-access/project-access-condition";
import type { PersonActor } from "../../task-change-request/actor";
import { loadPersonGrants } from "../../task-change-request/load-consent-facts";
import type { PendingRequestSummary } from "../../task-change-request/response";
import { visibleStatusMove } from "../../task-change-request/status-capability";
import { finishedAt } from "../../task/finished-at";
import { loadBlockLinks } from "../../task/get-open-blockers";
import { NO_BLOCKERS, summarizeBlockers } from "../../task/summarize-blockers";
import { taskIsCompleted } from "../../task/task-is-completed";
import { boardColumn } from "./board-column";
import { featureFinishedAt } from "./feature-finished-at";
import type { VisibleProject } from "./get-visible-projects";
import { parsePullRequest } from "./parse-pull-request";

export type BoardViewer = Pick<PersonActor, "userId" | "scope">;

const taskColumns = {
  id: taskTable.id,
  number: taskTable.number,
  title: taskTable.title,
  status: taskTable.status,
  statusGeneration: taskTable.statusGeneration,
  isCompleted: taskIsCompleted,
  priority: taskTable.priority,
  dueDate: taskTable.dueDate,
  // Only a completed task has finished; the subquery is skipped otherwise.
  finishedAt:
    sql<Date | null>`case when ${taskIsCompleted} then ${finishedAt} end`.mapWith(
      taskTable.updatedAt,
    ),
  projectId: taskTable.projectId,
  createdBy: taskTable.createdBy,
  assigneeId: userTable.id,
  assigneeName: userTable.name,
  assigneeImage: userTable.image,
};

type TaskRow = {
  id: string;
  number: number | null;
  title: string;
  status: string;
  statusGeneration: number;
  isCompleted: boolean;
  priority: string | null;
  dueDate: Date | null;
  finishedAt: Date | null;
  projectId: string;
  createdBy: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
  assigneeImage: string | null;
};

// The creator decides `statusChange` and stays server-side.
function toTask({
  assigneeId,
  assigneeName,
  assigneeImage,
  createdBy: _createdBy,
  ...task
}: TaskRow) {
  return {
    ...task,
    assignee: assigneeId
      ? { id: assigneeId, name: assigneeName ?? "", image: assigneeImage }
      : null,
  };
}

/**
 * The given top-level board items, each with its subtasks from any repo
 * project the caller can see, what each open item waits on, the "blocks"
 * links between those subtasks for the feature map, their pull requests and
 * what a status move by the caller does. The board and the one-item read
 * both build items here, so `column`, `finishedAt` and `statusChange` cannot
 * drift. Every read uses `database`, so a snapshot covers all of them.
 */
export async function loadBoardItems(
  database: DbOrTx,
  {
    workspaceId,
    boardProjectId,
    viewer,
    projects,
    taskIds,
    loadPending,
  }: {
    workspaceId: string;
    boardProjectId: string;
    viewer: BoardViewer;
    projects: VisibleProject[];
    /** Top-level board items to load. */
    taskIds: string[];
    loadPending: (
      ids: string[],
    ) => Promise<Map<string, NonNullable<PendingRequestSummary>>>;
  },
) {
  if (taskIds.length === 0) return [];
  const { userId } = viewer;
  const taskRows = await database
    .select({ ...taskColumns, description: taskTable.description })
    .from(taskTable)
    .leftJoin(userTable, eq(taskTable.userId, userTable.id))
    .where(
      and(
        inArray(taskTable.id, taskIds),
        eq(taskTable.projectId, boardProjectId),
      ),
    )
    .orderBy(asc(taskTable.number));

  const topIds = taskRows.map((f) => f.id);
  const links = topIds.length
    ? await database
        .select({
          parentId: taskRelationTable.sourceTaskId,
          childId: taskRelationTable.targetTaskId,
        })
        .from(taskRelationTable)
        .where(
          and(
            eq(taskRelationTable.relationType, "subtask"),
            inArray(taskRelationTable.sourceTaskId, topIds),
          ),
        )
    : [];

  const childIds = [...new Set(links.map((l) => l.childId))];
  const children = childIds.length
    ? await database
        .select(taskColumns)
        .from(taskTable)
        .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
        .leftJoin(userTable, eq(taskTable.userId, userTable.id))
        .where(
          and(
            inArray(taskTable.id, childIds),
            eq(projectTable.workspaceId, workspaceId),
            projectAccessCondition(userId, projectTable.id),
          ),
        )
        .orderBy(asc(taskTable.number))
    : [];
  const visibleIds = children.map((c) => c.id);

  const blockLinks = await loadBlockLinks(
    [...topIds, ...visibleIds],
    userId,
    workspaceId,
    database,
  );
  const prLinks = visibleIds.length
    ? await database
        .select({
          taskId: externalLinkTable.taskId,
          externalId: externalLinkTable.externalId,
          url: externalLinkTable.url,
          metadata: externalLinkTable.metadata,
        })
        .from(externalLinkTable)
        .where(
          and(
            inArray(externalLinkTable.taskId, visibleIds),
            eq(externalLinkTable.resourceType, "pull_request"),
          ),
        )
    : [];

  // Map edges only: both ends are visible subtasks, whatever their status.
  const visibleSet = new Set(visibleIds);
  const blockedBy = new Map<string, string[]>();
  for (const b of blockLinks) {
    if (!visibleSet.has(b.blockedId) || !visibleSet.has(b.blockerId)) continue;
    blockedBy.set(b.blockedId, [
      ...(blockedBy.get(b.blockedId) ?? []),
      b.blockerId,
    ]);
  }
  const prsByTask = new Map<string, ReturnType<typeof parsePullRequest>[]>();
  for (const link of prLinks) {
    prsByTask.set(link.taskId, [
      ...(prsByTask.get(link.taskId) ?? []),
      parsePullRequest(link),
    ]);
  }
  const childById = new Map(children.map((c) => [c.id, c]));

  // Consent facts once per read. `feature` counts every subtask link,
  // visible or not, as the status write does. A subtask has none (rule 4).
  const grants = await loadPersonGrants(database, workspaceId, viewer);
  const featureIds = new Set(links.map((l) => l.parentId));
  const statusChange = (row: TaskRow) => ({
    move: visibleStatusMove(grants, userId, {
      status: row.status,
      createdBy: row.createdBy,
      assigneeId: row.assigneeId,
      feature: featureIds.has(row.id),
    }),
  });

  // The key people say out loud: repo prefix and number, for example API-3.
  const slugByProject = new Map(projects.map((p) => [p.id, p.slug]));
  const keyOf = (task: { projectId: string; number: number | null }) =>
    `${slugByProject.get(task.projectId) ?? "?"}-${task.number ?? "?"}`;

  const items = taskRows.map(({ description, ...row }) => {
    const subtasks = links
      .filter((l) => l.parentId === row.id && childById.has(l.childId))
      .map((l) => {
        const child = childById.get(l.childId)!;
        return {
          ...toTask(child),
          key: keyOf(child),
          statusChange: statusChange(child),
          pullRequests: (prsByTask.get(child.id) ?? []).filter(
            (pr) => pr !== null,
          ),
          blockedBy: blockedBy.get(child.id) ?? [],
        };
      });
    const column = boardColumn(row, subtasks);
    return {
      ...toTask(row),
      key: keyOf(row),
      statusChange: statusChange(row),
      description,
      column,
      finishedAt: featureFinishedAt(row, column, subtasks),
      subtasks,
    };
  });

  // Only open items wait on anything: an unfinished subtask, or a top-level
  // item whose column is not done.
  const openIds = new Set([
    ...items.filter((t) => t.column !== "done").map((t) => t.id),
    ...children.filter((c) => !c.isCompleted).map((c) => c.id),
  ]);
  const blockers = summarizeBlockers(blockLinks, openIds);
  const pending = await loadPending([...topIds, ...visibleIds]);
  return items.map((task) => ({
    ...task,
    ...(blockers.get(task.id) ?? NO_BLOCKERS),
    pendingRequest: pending.get(task.id) ?? null,
    subtasks: task.subtasks.map((subtask) => ({
      ...subtask,
      ...(blockers.get(subtask.id) ?? NO_BLOCKERS),
      pendingRequest: pending.get(subtask.id) ?? null,
    })),
  }));
}
