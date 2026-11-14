import { eq, sql } from "drizzle-orm";
import type { User } from "better-auth/types";
import db, { schema } from "../../../apps/api/src/database";
import { createApp } from "../../../apps/api/src/index";
import { mockAuthenticatedSession } from "./auth";
import { createProjectFixture, createWorkspaceMember } from "./fixtures";
import { addWorkspaceMember } from "./project-access/add-workspace-member";

/**
 * A workspace with one task created by `creator` and assigned to `assignee`.
 * `outsider` is a plain member who is neither; `admin` bypasses consent.
 */
export async function changeRequestFixture(slug = "API") {
  const { user: creator, workspace } = await createWorkspaceMember();
  const assignee = await addWorkspaceMember(workspace.id);
  const outsider = await addWorkspaceMember(workspace.id);
  const admin = await addWorkspaceMember(workspace.id, "admin");
  const { project, columns } = await createProjectFixture({
    workspaceId: workspace.id,
    slug,
  });
  const [task] = await db
    .insert(schema.taskTable)
    .values({
      projectId: project.id,
      columnId: columns.todo.id,
      title: "Ship the thing",
      status: "to-do",
      number: 1,
      position: 1,
      createdBy: creator.id,
      userId: assignee.id,
    })
    .returning();
  return {
    workspace,
    project,
    columns,
    task,
    creator,
    assignee,
    outsider,
    admin,
  };
}

/** Sends requests to a fresh app signed in as `user` (cookie session). */
export function as(user: { id: string }) {
  mockAuthenticatedSession(user as User);
  const { app } = createApp();
  return (path: string, init: RequestInit = {}) =>
    app.request(path, {
      ...init,
      headers: { "content-type": "application/json", ...init.headers },
    });
}

export function setStatus(
  user: { id: string },
  taskId: string,
  status: string,
) {
  return as(user)(`/api/task/status/${taskId}`, {
    method: "PUT",
    body: JSON.stringify({ status }),
  });
}

export function answer(
  user: { id: string },
  requestId: string,
  decision: "accept" | "reject" | "cancel",
) {
  return as(user)(`/api/task-change-request/${requestId}/${decision}`, {
    method: "POST",
  });
}

export async function readTask(taskId: string) {
  return db.query.taskTable.findFirst({
    where: eq(schema.taskTable.id, taskId),
  });
}

export async function readRequest(requestId: string) {
  return db.query.taskChangeRequestTable.findFirst({
    where: eq(schema.taskChangeRequestTable.id, requestId),
  });
}

/** Opens a status request as `user` and returns its id. */
export async function requestStatus(
  user: { id: string },
  taskId: string,
  status: string,
) {
  const response = await setStatus(user, taskId, status);
  if (response.status !== 202)
    throw new Error(`Expected 202, got ${response.status}`);
  const body = (await response.json()) as { request: { id: string } };
  return body.request.id;
}

/** Moves a request's deadline into the past so the timeout job picks it. */
export async function makeDue(requestId: string) {
  await db
    .update(schema.taskChangeRequestTable)
    .set({
      expiresAt: sql`(now() AT TIME ZONE 'utc') - interval '1 minute'`,
    })
    .where(eq(schema.taskChangeRequestTable.id, requestId));
}
