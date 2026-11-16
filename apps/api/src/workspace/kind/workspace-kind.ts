import { type SQLWrapper, sql } from "drizzle-orm";

/** A real team workspace, or one user's product-tour sandbox. */
export const WORKSPACE_KINDS = ["team", "demo"] as const;
export type WorkspaceKind = (typeof WORKSPACE_KINDS)[number];

/** An unknown value is treated as a demo: the kind that does less. */
export function toWorkspaceKind(value: unknown): WorkspaceKind {
  return value === "team" ? "team" : "demo";
}

// Raw aliases keep these subqueries independent of the outer query's tables,
// like active-workspace-sql.ts.

/** True when the workspace with this id is a team workspace. */
export function workspaceIsTeam(workspaceId: SQLWrapper) {
  return sql<boolean>`exists (
    select 1 from "workspace" as "kind_workspace"
    where "kind_workspace"."id" = ${workspaceId}
      and "kind_workspace"."kind" = 'team'
  )`;
}

/** True when the project with this id belongs to a team workspace. */
export function projectInTeamWorkspace(projectId: SQLWrapper) {
  return sql<boolean>`exists (
    select 1 from "project" as "kind_project"
    inner join "workspace" as "kind_workspace"
      on "kind_workspace"."id" = "kind_project"."workspace_id"
    where "kind_project"."id" = ${projectId}
      and "kind_workspace"."kind" = 'team'
  )`;
}

/** True when the task with this id belongs to a team workspace. */
export function taskInTeamWorkspace(taskId: SQLWrapper) {
  return sql<boolean>`exists (
    select 1 from "task" as "kind_task"
    inner join "project" as "kind_project"
      on "kind_project"."id" = "kind_task"."project_id"
    inner join "workspace" as "kind_workspace"
      on "kind_workspace"."id" = "kind_project"."workspace_id"
    where "kind_task"."id" = ${taskId}
      and "kind_workspace"."kind" = 'team'
  )`;
}
