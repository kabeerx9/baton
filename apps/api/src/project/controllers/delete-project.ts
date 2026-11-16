import { and, asc, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { projectTable, assetTable, taskTable } from "../../database/schema";
import { cancelPendingRequestsInProject } from "../../task-change-request/cancel-pending";
import {
  dispatchRequestEffects,
  finishedEffects,
} from "../../task-change-request/effects";
import type { ChangeRequestRow } from "../../task-change-request/response";
import { publishEvent } from "../../events";
import { queueStorageCleanup } from "../../storage/cleanup-queue";
import { getProjectSubtaskParentProjects } from "../../task/get-subtask-parent-projects";
import getProject from "./get-project";
import { deleteResourceNotifications } from "../../notification/delete-resource-notifications";

async function deleteProject(id: string, workspaceId: string) {
  const existingProject = await getProject(id, workspaceId);

  const parents = await getProjectSubtaskParentProjects(id);

  const cancelled: ChangeRequestRow[] = [];
  const deletedProject = await db.transaction(async (tx) => {
    // Lock the owner before collecting keys so uploads cannot race the cascade.
    const [project] = await tx
      .select()
      .from(projectTable)
      .where(
        and(eq(projectTable.id, id), eq(projectTable.workspaceId, workspaceId)),
      )
      .for("update");
    if (!project)
      throw new HTTPException(404, { message: "Project not found" });
    const assets = await tx
      .select({ objectKey: assetTable.objectKey })
      .from(assetTable)
      .where(eq(assetTable.projectId, id));
    await queueStorageCleanup(tx, [
      ...assets.map((asset) => asset.objectKey),
      ...(project.backgroundObjectKey ? [project.backgroundObjectKey] : []),
    ]);
    // Lock order: project, tasks, then change requests. The repo's open
    // requests end as cancelled and keep their history after the cascade.
    await tx
      .select({ id: taskTable.id })
      .from(taskTable)
      .where(eq(taskTable.projectId, id))
      .orderBy(asc(taskTable.id))
      .for("update");
    // The cascade below sets their task and project to null.
    for (const request of await cancelPendingRequestsInProject(
      tx,
      id,
      "task_deleted",
    ))
      cancelled.push({ ...request, taskId: null, projectId: null });
    await deleteResourceNotifications(tx, { projectIds: [id] });
    const [deleted] = await tx
      .delete(projectTable)
      .where(
        and(eq(projectTable.id, id), eq(projectTable.workspaceId, workspaceId)),
      )
      .returning();
    return deleted;
  });
  if (!deletedProject) {
    throw new HTTPException(500, {
      message: "Failed to delete project",
    });
  }

  await dispatchRequestEffects(finishedEffects(cancelled, null));
  await publishEvent("subtask-parents.refresh", {
    projects: parents.filter((parent) => parent.projectId !== id),
  });

  return existingProject;
}

export default deleteProject;
