import { eq } from "drizzle-orm";
import type db from "../database";
import {
  projectTable,
  taskTable,
  userTable,
  workspaceTable,
} from "../database/schema";

type Locker = Pick<typeof db, "select">;

/**
 * A notification names its resource without a foreign key, so deleting the
 * resource cleans its notifications up by hand (deleteResourceNotifications).
 * Creation takes KEY SHARE on the same rows the deletions lock FOR UPDATE, in
 * the order user -> workspace -> task. A concurrent delete then either waits
 * for this insert and removes it, or commits first and the access check
 * after this lock no longer finds the resource. Callers that write other
 * rows referencing the task (a reminder claim) call this first. Returns
 * false when the resource is gone.
 */
export async function lockNotificationResource(
  tx: Locker,
  userId: string,
  resourceId?: string | null,
  resourceType?: string | null,
) {
  if (!resourceId || (resourceType !== "task" && resourceType !== "workspace"))
    return true;
  let workspaceId = resourceId;
  if (resourceType === "task") {
    const [task] = await tx
      .select({ workspaceId: projectTable.workspaceId })
      .from(taskTable)
      .innerJoin(projectTable, eq(projectTable.id, taskTable.projectId))
      .where(eq(taskTable.id, resourceId));
    if (!task) return false;
    workspaceId = task.workspaceId;
  }
  await tx
    .select({ id: userTable.id })
    .from(userTable)
    .where(eq(userTable.id, userId))
    .for("key share");
  const workspace = await tx
    .select({ id: workspaceTable.id })
    .from(workspaceTable)
    .where(eq(workspaceTable.id, workspaceId))
    .for("key share");
  if (resourceType === "workspace") return workspace.length > 0;
  const task = await tx
    .select({ id: taskTable.id })
    .from(taskTable)
    .where(eq(taskTable.id, resourceId))
    .for("key share");
  return task.length > 0;
}
