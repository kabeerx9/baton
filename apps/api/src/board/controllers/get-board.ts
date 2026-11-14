import { and, asc, eq, inArray, isNull, not, sql } from "drizzle-orm";
import db from "../../database";
import {
  externalLinkTable,
  integrationTable,
  projectTable,
  taskRelationTable,
  taskTable,
  userTable,
  workspaceUserTable,
} from "../../database/schema";
import { projectAccessCondition } from "../../project-access/project-access-condition";
import { finishedAt } from "../../task/finished-at";
import { loadBlockLinks } from "../../task/get-open-blockers";
import { isSubtask } from "../../task/is-subtask";
import { NO_BLOCKERS, summarizeBlockers } from "../../task/summarize-blockers";
import { taskIsCompleted } from "../../task/task-is-completed";
import { ensureBoardProject } from "./ensure-board-project";
import { boardColumn } from "./board-column";
import { parsePullRequest } from "./parse-pull-request";
import { parseRepository } from "./parse-repository";

const taskColumns = {
  id: taskTable.id,
  number: taskTable.number,
  title: taskTable.title,
  status: taskTable.status,
  isCompleted: taskIsCompleted,
  priority: taskTable.priority,
  dueDate: taskTable.dueDate,
  // Only a completed task has finished; the subquery is skipped otherwise.
  finishedAt:
    sql<Date | null>`case when ${taskIsCompleted} then ${finishedAt} end`.mapWith(
      taskTable.updatedAt,
    ),
  projectId: taskTable.projectId,
  assigneeId: userTable.id,
  assigneeName: userTable.name,
  assigneeImage: userTable.image,
};

type TaskRow = {
  id: string;
  number: number | null;
  title: string;
  status: string;
  isCompleted: boolean;
  priority: string | null;
  dueDate: Date | null;
  finishedAt: Date | null;
  projectId: string;
  assigneeId: string | null;
  assigneeName: string | null;
  assigneeImage: string | null;
};

function toTask({ assigneeId, assigneeName, assigneeImage, ...task }: TaskRow) {
  return {
    ...task,
    assignee: assigneeId
      ? { id: assigneeId, name: assigneeName ?? "", image: assigneeImage }
      : null,
  };
}

/**
 * The workspace's board: every task, each with its subtasks from
 * any repo project the caller can see, what each open item waits on, the
 * "blocks" links between those subtasks for the feature map, and their pull
 * requests. Joined here so the web views and MCP
 * agents read the same shape in one request.
 */
async function getBoard(workspaceId: string, userId: string) {
  const { id: projectId } = await ensureBoardProject(workspaceId);
  const taskRows = await db
    .select({ ...taskColumns, description: taskTable.description })
    .from(taskTable)
    .leftJoin(userTable, eq(taskTable.userId, userTable.id))
    .where(and(eq(taskTable.projectId, projectId), not(isSubtask)))
    .orderBy(asc(taskTable.number));

  const projects = await getVisibleProjects(workspaceId, userId);

  const taskIds = taskRows.map((f) => f.id);
  const links = taskIds.length
    ? await db
        .select({
          parentId: taskRelationTable.sourceTaskId,
          childId: taskRelationTable.targetTaskId,
        })
        .from(taskRelationTable)
        .where(
          and(
            eq(taskRelationTable.relationType, "subtask"),
            inArray(taskRelationTable.sourceTaskId, taskIds),
          ),
        )
    : [];

  const childIds = [...new Set(links.map((l) => l.childId))];
  const children = childIds.length
    ? await db
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

  const [blockLinks, prLinks] = await Promise.all([
    loadBlockLinks([...taskIds, ...visibleIds], userId, workspaceId),
    visibleIds.length
      ? db
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
      : [],
  ]);

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
  const tasks = items.map((task) => ({
    ...task,
    ...(blockers.get(task.id) ?? NO_BLOCKERS),
    subtasks: task.subtasks.map((subtask) => ({
      ...subtask,
      ...(blockers.get(subtask.id) ?? NO_BLOCKERS),
    })),
  }));

  const members = await db
    .select({
      id: userTable.id,
      name: userTable.name,
      image: userTable.image,
    })
    .from(workspaceUserTable)
    .innerJoin(userTable, eq(userTable.id, workspaceUserTable.userId))
    .where(eq(workspaceUserTable.workspaceId, workspaceId))
    .orderBy(asc(userTable.name));

  return { tasks, projects, members };
}

/**
 * A plain task keeps its own finish time. A feature finished when its last
 * visible subtask did, and only once its column is done.
 */
function featureFinishedAt(
  task: { finishedAt: Date | null },
  column: string,
  subtasks: Array<{ finishedAt: Date | null }>,
) {
  if (subtasks.length === 0) return task.finishedAt;
  if (column !== "done") return null;
  let latest: Date | null = null;
  for (const { finishedAt } of subtasks) {
    if (finishedAt && (!latest || finishedAt > latest)) latest = finishedAt;
  }
  return latest;
}

async function getVisibleProjects(workspaceId: string, userId: string) {
  const rows = await db
    .select({
      id: projectTable.id,
      name: projectTable.name,
      slug: projectTable.slug,
      icon: projectTable.icon,
      kind: projectTable.kind,
      integrationType: integrationTable.type,
      integrationConfig: integrationTable.config,
    })
    .from(projectTable)
    .leftJoin(
      integrationTable,
      and(
        eq(integrationTable.projectId, projectTable.id),
        eq(integrationTable.type, "github"),
        eq(integrationTable.isActive, true),
      ),
    )
    .where(
      and(
        eq(projectTable.workspaceId, workspaceId),
        isNull(projectTable.archivedAt),
        projectAccessCondition(userId, projectTable.id),
      ),
    )
    .orderBy(asc(projectTable.position));

  const byId = new Map<
    string,
    {
      id: string;
      name: string;
      slug: string;
      icon: string | null;
      kind: "repo" | "board";
      repository: string | null;
    }
  >();
  for (const r of rows) {
    const existing = byId.get(r.id);
    const repository = r.integrationConfig
      ? parseRepository(r.integrationConfig)
      : null;
    if (existing) {
      existing.repository ??= repository;
      continue;
    }
    byId.set(r.id, {
      id: r.id,
      name: r.name,
      slug: r.slug,
      icon: r.icon,
      kind: r.kind === "board" ? "board" : "repo",
      repository,
    });
  }
  return [...byId.values()];
}

export default getBoard;
