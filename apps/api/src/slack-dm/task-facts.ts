import { and, eq, inArray, not, sql } from "drizzle-orm";
import db from "../database";
import {
  projectTable,
  slackUserLinkTable,
  taskRelationTable,
  taskTable,
  userTable,
} from "../database/schema";
import { taskIsCompleted } from "../task/task-is-completed";
import { taskInTeamWorkspace } from "../workspace/kind/workspace-kind";
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

/** A stored zone value (null when unset) and the local day due in it. */
export type DueZone = { stored: string | null; day: string };

/**
 * Every "blocks" link where both tasks are open and the blocker's owner is
 * due a digest: their stored zone is one of `due`, and their last digest day
 * is earlier than that zone's day. SQL only compares the stored strings, so a
 * zone name Postgres does not know cannot fail the statement.
 */
export async function dueBlockingLinks(clientUrl: string, due: DueZone[]) {
  if (due.length === 0) return [];
  const result = await db.execute<{
    blocker_id: string;
    blocked_id: string;
    zone: string | null;
    day: string;
  }>(sql`
    select ${taskRelationTable.sourceTaskId} as blocker_id,
      ${taskRelationTable.targetTaskId} as blocked_id,
      due.zone as zone,
      due.day as day
    from ${taskRelationTable}
    inner join ${taskTable} on ${taskTable.id} = ${taskRelationTable.sourceTaskId}
    inner join ${userTable} on ${userTable.id} = ${taskTable.userId}
    inner join unnest(
      ${sql.param(due.map((zone) => zone.stored))}::text[],
      ${sql.param(due.map((zone) => zone.day))}::text[]
    ) as due(zone, day) on due.zone is not distinct from ${userTable.timeZone}
    left join ${slackUserLinkTable} on ${slackUserLinkTable.userId} = ${userTable.id}
    where ${taskRelationTable.relationType} = 'blocks'
      and (${slackUserLinkTable.lastDigestDay} is null
        or ${slackUserLinkTable.lastDigestDay} < due.day)
      -- Demo workspaces are private sandboxes; the digest never lists them.
      and ${taskInTeamWorkspace(taskRelationTable.sourceTaskId)}
  `);
  const links = result.rows;
  const facts = await loadTasks(
    [...new Set(links.flatMap((l) => [l.blocker_id, l.blocked_id]))],
    clientUrl,
  );
  return links.flatMap((link) => {
    const blocker = facts.get(link.blocker_id);
    const blocked = facts.get(link.blocked_id);
    if (!blocker || !blocked || blocker.completed || blocked.completed) {
      return [];
    }
    return [{ blocker, blocked, zone: link.zone, day: link.day }];
  });
}
