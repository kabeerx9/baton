import {
  and,
  count,
  desc,
  eq,
  inArray,
  ne,
  or,
  type SQL,
  sql,
} from "drizzle-orm";
import db from "../database";
import {
  projectTable,
  taskChangeRequestTable,
  taskTable,
} from "../database/schema";
import { projectAccessCondition } from "../project-access/project-access-condition";
import type { PermissionMap } from "../utils/role-permissions";
import { loadPersonGrants } from "./load-consent-facts";

/**
 * Who may read a request: anyone who can see its repo (board tasks: every
 * member), plus its requester and decider, so history survives a move or a
 * deleted task.
 */
export function canReadRequest(userId: string) {
  return or(
    eq(taskChangeRequestTable.requestedBy, userId),
    eq(taskChangeRequestTable.decidedBy, userId),
    sql`exists (
      select 1 from ${projectTable}
      where ${projectTable.id} = ${taskChangeRequestTable.projectId}
        and (${projectTable.kind} = 'board' or ${projectAccessCondition(userId, projectTable.id)})
    )`,
  )!;
}

export type ListFilters = {
  workspaceId: string;
  taskId?: string;
  requestedBy?: "me";
  canAnswer?: "me";
  state?: string;
  limit: number;
  offset: number;
};

export async function listChangeRequests(
  userId: string,
  scope: PermissionMap | null,
  filters: ListFilters,
) {
  const conditions: SQL[] = [
    eq(taskChangeRequestTable.workspaceId, filters.workspaceId),
    canReadRequest(userId),
  ];
  if (filters.taskId)
    conditions.push(eq(taskChangeRequestTable.taskId, filters.taskId));
  if (filters.state)
    conditions.push(eq(taskChangeRequestTable.state, filters.state));
  if (filters.requestedBy === "me")
    conditions.push(eq(taskChangeRequestTable.requestedBy, userId));
  if (filters.canAnswer === "me") {
    // Pending requests made by someone else, of a kind the caller has the
    // permission to answer (status: task:update, delete: task:delete, both
    // narrowed by an API key), on tasks they created or are assigned (or
    // any task, for an owner or admin). Accept re-checks all of it under lock.
    const grants = await loadPersonGrants(db, filters.workspaceId, {
      userId,
      scope,
    });
    const kinds = [
      grants.can({ task: ["update"] }) && "status",
      grants.can({ task: ["delete"] }) && "delete",
    ].filter((kind): kind is string => Boolean(kind));
    conditions.push(
      kinds.length ? inArray(taskChangeRequestTable.kind, kinds) : sql`false`,
      eq(taskChangeRequestTable.state, "pending"),
      ne(sql`coalesce(${taskChangeRequestTable.requestedBy}, '')`, userId),
      grants.bypass
        ? sql`true`
        : sql`exists (
            select 1 from ${taskTable}
            where ${taskTable.id} = ${taskChangeRequestTable.taskId}
              and (${taskTable.createdBy} = ${userId} or ${taskTable.userId} = ${userId})
          )`,
    );
  }
  const where = and(...conditions);
  const [rows, [total]] = await Promise.all([
    db
      .select()
      .from(taskChangeRequestTable)
      .where(where)
      .orderBy(
        desc(taskChangeRequestTable.createdAt),
        desc(taskChangeRequestTable.id),
      )
      .limit(filters.limit)
      .offset(filters.offset),
    db.select({ total: count() }).from(taskChangeRequestTable).where(where),
  ]);
  return { rows, total: total?.total ?? 0 };
}
