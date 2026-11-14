import { and, eq, inArray, not } from "drizzle-orm";
import db from "../database";
import {
  projectTable,
  taskRelationTable,
  taskTable,
  userTable,
} from "../database/schema";
import { taskIsCompleted } from "../task/task-is-completed";
import type { TaskRef } from "./messages";

export type TaskFacts = TaskRef & {
  id: string;
  workspaceId: string;
  ownerId: string | null;
  ownerName: string | null;
  completed: boolean;
};

const columns = {
  id: taskTable.id,
  title: taskTable.title,
  number: taskTable.number,
  slug: projectTable.slug,
  projectId: projectTable.id,
  workspaceId: projectTable.workspaceId,
  ownerId: taskTable.userId,
  ownerName: userTable.name,
  completed: taskIsCompleted,
};

type Row = {
  id: string;
  title: string;
  number: number | null;
  slug: string;
  projectId: string;
  workspaceId: string;
  ownerId: string | null;
  ownerName: string | null;
  completed: boolean;
};

function toFacts(row: Row, clientUrl: string): TaskFacts {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    key: `${row.slug}-${row.number ?? "?"}`,
    title: row.title,
    url: `${clientUrl}/dashboard/workspace/${row.workspaceId}/project/${row.projectId}/task/${row.id}`,
    ownerId: row.ownerId,
    // First name only: the message reads like a person wrote it.
    ownerName: row.ownerName?.trim().split(/\s+/)[0] ?? null,
    completed: row.completed,
  };
}

const tasks = () =>
  db
    .select(columns)
    .from(taskTable)
    .innerJoin(projectTable, eq(projectTable.id, taskTable.projectId))
    .leftJoin(userTable, eq(userTable.id, taskTable.userId));

export async function loadTasks(ids: string[], clientUrl: string) {
  const found = new Map<string, TaskFacts>();
  if (ids.length === 0) return found;
  for (const row of await tasks().where(inArray(taskTable.id, ids))) {
    found.set(row.id, toFacts(row, clientUrl));
  }
  return found;
}

/** Ids of the tasks that the given task blocks. */
export async function blockedBy(blockerId: string) {
  const rows = await db
    .select({ id: taskRelationTable.targetTaskId })
    .from(taskRelationTable)
    .where(
      and(
        eq(taskRelationTable.relationType, "blocks"),
        eq(taskRelationTable.sourceTaskId, blockerId),
      ),
    );
  return rows.map((row) => row.id);
}

/** The open tasks that still block the given task. */
export async function openBlockersOf(taskId: string, clientUrl: string) {
  const rows = await tasks()
    .innerJoin(
      taskRelationTable,
      and(
        eq(taskRelationTable.sourceTaskId, taskTable.id),
        eq(taskRelationTable.relationType, "blocks"),
      ),
    )
    .where(
      and(eq(taskRelationTable.targetTaskId, taskId), not(taskIsCompleted)),
    );
  return rows.map((row) => toFacts(row, clientUrl));
}

/** Every "blocks" link where both the blocker and the blocked task are open. */
export async function openBlockingLinks(clientUrl: string) {
  const links = await db
    .select({
      blockerId: taskRelationTable.sourceTaskId,
      blockedId: taskRelationTable.targetTaskId,
    })
    .from(taskRelationTable)
    .where(eq(taskRelationTable.relationType, "blocks"));
  const facts = await loadTasks(
    [...new Set(links.flatMap((l) => [l.blockerId, l.blockedId]))],
    clientUrl,
  );
  return links.flatMap((link) => {
    const blocker = facts.get(link.blockerId);
    const blocked = facts.get(link.blockedId);
    if (!blocker || !blocked || blocker.completed || blocked.completed) {
      return [];
    }
    return [{ blocker, blocked }];
  });
}
