import { and, eq, inArray, or, sql } from "drizzle-orm";
import { notificationTable, projectTable, taskTable } from "../database/schema";
import type { DbOrTx } from "../project-access/db-or-tx";

type Scope =
  | { taskIds: string[] }
  | { projectIds: string[] }
  | { workspaceIds: string[] };

/**
 * A notification names its resource by id, with no foreign key, so deleting
 * a task, project or workspace leaves its notifications behind as orphans.
 * Call this in the deleting transaction, before the delete, while the tasks
 * can still be found. A workspace scope also removes notifications whose
 * event data names the workspace, which covers tasks deleted before this
 * cleanup existed.
 */
export async function deleteResourceNotifications(tx: DbOrTx, scope: Scope) {
  const ids =
    "taskIds" in scope
      ? scope.taskIds
      : "projectIds" in scope
        ? scope.projectIds
        : scope.workspaceIds;
  if (ids.length === 0) return;
  const taskIds =
    "taskIds" in scope
      ? scope.taskIds
      : tx
          .select({ id: taskTable.id })
          .from(taskTable)
          .innerJoin(projectTable, eq(projectTable.id, taskTable.projectId))
          .where(
            "projectIds" in scope
              ? inArray(projectTable.id, scope.projectIds)
              : inArray(projectTable.workspaceId, scope.workspaceIds),
          );
  const byTask = and(
    eq(notificationTable.resourceType, "task"),
    inArray(notificationTable.resourceId, taskIds),
  );
  await tx
    .delete(notificationTable)
    .where(
      "workspaceIds" in scope
        ? or(
            byTask,
            and(
              eq(notificationTable.resourceType, "workspace"),
              inArray(notificationTable.resourceId, scope.workspaceIds),
            ),
            inArray(
              sql`${notificationTable.eventData}->>'workspaceId'`,
              scope.workspaceIds,
            ),
          )
        : byTask,
    );
}
