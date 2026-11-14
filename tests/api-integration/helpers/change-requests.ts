import { and, eq, sql } from "drizzle-orm";
import { vi } from "vite-plus/test";
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

/** Creates an API key for `userId`; no permissions means the user's own. */
export async function createKey(
  userId: string,
  permissions?: Record<string, string[]>,
) {
  const { auth } = await import("../../../apps/api/src/auth");
  const created = await auth.api.createApiKey({
    body: { userId, name: "Change request test", permissions },
  });
  return { id: created.id, key: created.key };
}

/** Sends requests to a fresh app with an API key and no session. */
export function withKey(key: string) {
  vi.restoreAllMocks();
  const { app } = createApp();
  return (path: string, init: RequestInit = {}) =>
    app.request(path, {
      ...init,
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        ...init.headers,
      },
    });
}

/** Notifications a user got about change request outcomes. */
export async function outcomeNotifications(userId: string) {
  return db
    .select()
    .from(schema.notificationTable)
    .where(
      and(
        eq(schema.notificationTable.userId, userId),
        eq(schema.notificationTable.type, "task_change_request_finished"),
      ),
    );
}

/**
 * Moves the fixture's project into a new workspace owned by `owner`.
 * `members` also join the new workspace as plain members.
 */
export async function moveToNewWorkspace(
  f: Awaited<ReturnType<typeof changeRequestFixture>>,
  owner: { id: string },
  members: { id: string }[] = [],
) {
  const { default: moveProject } =
    await import("../../../apps/api/src/project/controllers/move-project");
  const id = `workspace-target-${f.project.id}`;
  const [target] = await db
    .insert(schema.workspaceTable)
    .values({ id, name: "Target", slug: id, createdAt: new Date() })
    .returning();
  await db.insert(schema.workspaceUserTable).values([
    { workspaceId: id, userId: owner.id, role: "owner", joinedAt: new Date() },
    ...members.map((member) => ({
      workspaceId: id,
      userId: member.id,
      role: "member",
      joinedAt: new Date(),
    })),
  ]);
  await moveProject(f.project.id, f.workspace.id, id, owner.id);
  return target;
}
