import { eq } from "drizzle-orm";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { auth } from "../../apps/api/src/auth";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import {
  answer,
  as,
  changeRequestFixture,
  readRequest,
  readTask,
  requestStatus,
  setStatus,
} from "./helpers/change-requests";
import { resetTestDatabase } from "./helpers/database";
import { createProjectFixture } from "./helpers/fixtures";
import { addWorkspaceMember } from "./helpers/project-access/add-workspace-member";
import { restrictToProjects } from "./helpers/project-access/restrict-to-projects";

beforeEach(resetTestDatabase);
afterEach(() => vi.restoreAllMocks());

function assign(user: { id: string }, taskId: string, userId: string | null) {
  return as(user)(`/api/task/assignee/${taskId}`, {
    method: "PUT",
    body: JSON.stringify({ userId }),
  });
}

// Built-in members lack task:assign; a custom role grants it so that only
// the consent rule decides.
async function grantAssign(workspaceId: string, userIds: string[]) {
  await db.insert(schema.workspaceRoleTable).values({
    workspaceId,
    role: "lead",
    permission: JSON.stringify({ task: ["read", "update", "assign"] }),
  });
  for (const userId of userIds)
    await db
      .update(schema.workspaceUserTable)
      .set({ role: "lead" })
      .where(eq(schema.workspaceUserTable.userId, userId));
}

async function createKey(
  userId: string,
  permissions?: Record<string, string[]>,
) {
  const { key } = await auth.api.createApiKey({
    body: { userId, name: "Change request test", permissions },
  });
  return key;
}

function setStatusWithKey(key: string, taskId: string, status: string) {
  vi.restoreAllMocks();
  const { app } = createApp();
  return app.request(`/api/task/status/${taskId}`, {
    method: "PUT",
    headers: { "content-type": "application/json", "x-api-key": key },
    body: JSON.stringify({ status }),
  });
}

describe("status change consent", () => {
  it("turns an outsider's status change into a pending request", async () => {
    const f = await changeRequestFixture();
    const response = await setStatus(f.outsider, f.task.id, "in-progress");
    expect(response.status).toBe(202);
    const body = await response.json();
    expect(body).toMatchObject({
      outcome: "requested",
      task: { id: f.task.id, status: "to-do" },
      request: {
        state: "pending",
        kind: "status",
        targetStatus: "in-progress",
        baseStatus: "to-do",
        requestedBy: f.outsider.id,
        channel: "web",
      },
    });
    expect((await readTask(f.task.id))?.status).toBe("to-do");

    const detail = await (await as(f.creator)(`/api/task/${f.task.id}`)).json();
    expect(detail.pendingRequest).toMatchObject({
      id: body.request.id,
      kind: "status",
      targetStatus: "in-progress",
      requestedBy: f.outsider.id,
    });
  });

  it.each(["creator", "assignee", "admin"] as const)(
    "applies a status change by the %s directly",
    async (who) => {
      const f = await changeRequestFixture();
      const response = await setStatus(f[who], f.task.id, "in-progress");
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({
        outcome: "applied",
        task: { status: "in-progress" },
      });
      expect(await db.select().from(schema.taskChangeRequestTable)).toEqual([]);
    },
  );

  it("applies a status change by the workspace owner directly", async () => {
    const f = await changeRequestFixture();
    const owner = await addWorkspaceMember(f.workspace.id, "owner");
    const response = await setStatus(owner, f.task.id, "in-progress");
    expect(response.status).toBe(200);
  });

  it("refuses an involved viewer, who lacks task:update", async () => {
    const f = await changeRequestFixture();
    const viewer = await addWorkspaceMember(f.workspace.id, "viewer");
    await db
      .update(schema.taskTable)
      .set({ userId: viewer.id })
      .where(eq(schema.taskTable.id, f.task.id));
    const response = await setStatus(viewer, f.task.id, "in-progress");
    expect(response.status).toBe(403);
    expect((await readTask(f.task.id))?.status).toBe("to-do");
    expect(await db.select().from(schema.taskChangeRequestTable)).toEqual([]);
  });

  it("follows a custom role: task:update requests, no bypass", async () => {
    const f = await changeRequestFixture();
    await db.insert(schema.workspaceRoleTable).values({
      workspaceId: f.workspace.id,
      role: "triage",
      permission: JSON.stringify({ task: ["read", "update"] }),
    });
    const triage = await addWorkspaceMember(f.workspace.id, "triage");
    const response = await setStatus(triage, f.task.id, "in-progress");
    expect(response.status).toBe(202);
  });

  it("keeps an API key's scope and records the agent channel", async () => {
    const f = await changeRequestFixture();
    const readOnly = await createKey(f.outsider.id, { task: ["read"] });
    expect(
      (await setStatusWithKey(readOnly, f.task.id, "in-progress")).status,
    ).toBe(403);
    expect(await db.select().from(schema.taskChangeRequestTable)).toEqual([]);

    const writer = await createKey(f.outsider.id);
    const response = await setStatusWithKey(writer, f.task.id, "in-progress");
    expect(response.status).toBe(202);
    expect(await response.json()).toMatchObject({
      request: { channel: "agent" },
    });

    const creatorKey = await createKey(f.creator.id);
    expect(
      (await setStatusWithKey(creatorKey, f.task.id, "in-review")).status,
    ).toBe(200);
    const activities = await db
      .select()
      .from(schema.activityTable)
      .where(eq(schema.activityTable.taskId, f.task.id));
    expect(activities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "status_changed", channel: "agent" }),
      ]),
    );
  });

  it("cancels an accepted request when the requester lost project access", async () => {
    const f = await changeRequestFixture();
    const requestId = await requestStatus(f.outsider, f.task.id, "in-progress");
    const other = await createProjectFixture({ workspaceId: f.workspace.id });
    await restrictToProjects(f.workspace.id, f.outsider.id, [other.project.id]);

    const response = await answer(f.creator, requestId, "accept");
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      request: { state: "cancelled", reason: "requester_lost_access" },
    });
    expect((await readTask(f.task.id))?.status).toBe("to-do");
  });
});

describe("answering", () => {
  it("lets only involved people or bypass roles answer, never the requester", async () => {
    const f = await changeRequestFixture();
    const bystander = await addWorkspaceMember(f.workspace.id);
    const requestId = await requestStatus(f.outsider, f.task.id, "in-progress");

    expect((await answer(f.outsider, requestId, "accept")).status).toBe(403);
    expect((await answer(bystander, requestId, "accept")).status).toBe(403);
    expect((await answer(bystander, requestId, "cancel")).status).toBe(403);
    expect((await readRequest(requestId))?.state).toBe("pending");

    const accepted = await answer(f.assignee, requestId, "accept");
    expect(accepted.status).toBe(200);
    expect(await accepted.json()).toMatchObject({
      request: { state: "accepted", decidedBy: f.assignee.id },
      task: { status: "in-progress" },
    });
  });

  it("lets the requester withdraw and an admin reject", async () => {
    const f = await changeRequestFixture();
    const first = await requestStatus(f.outsider, f.task.id, "in-progress");
    expect((await answer(f.outsider, first, "cancel")).status).toBe(200);
    expect(await readRequest(first)).toMatchObject({
      state: "cancelled",
      reason: "withdrawn",
    });

    const second = await requestStatus(f.outsider, f.task.id, "in-review");
    const rejected = await answer(f.admin, second, "reject");
    expect(await rejected.json()).toMatchObject({
      request: { state: "rejected" },
    });
    expect((await readTask(f.task.id))?.status).toBe("to-do");
  });

  it("hides another workspace's request", async () => {
    const f = await changeRequestFixture();
    const g = await changeRequestFixture("WEB");
    const requestId = await requestStatus(f.outsider, f.task.id, "in-progress");
    expect(
      (await as(g.creator)(`/api/task-change-request/${requestId}`)).status,
    ).toBe(404);
    expect((await answer(g.admin, requestId, "accept")).status).toBe(404);
  });
});

describe("reassignment consent", () => {
  it("refuses outsider self-assignment, accomplice assignment and clearing", async () => {
    const f = await changeRequestFixture();
    const accomplice = await addWorkspaceMember(f.workspace.id);
    await grantAssign(f.workspace.id, [f.outsider.id]);
    for (const userId of [f.outsider.id, accomplice.id, null]) {
      const response = await assign(f.outsider, f.task.id, userId);
      expect(response.status).toBe(403);
    }
    expect((await readTask(f.task.id))?.userId).toBe(f.assignee.id);
    expect(await db.select().from(schema.taskChangeRequestTable)).toEqual([]);
  });

  it("lets involved people and admins reassign", async () => {
    const f = await changeRequestFixture();
    await grantAssign(f.workspace.id, [f.creator.id]);
    expect((await assign(f.creator, f.task.id, f.outsider.id)).status).toBe(
      200,
    );
    expect((await assign(f.admin, f.task.id, f.admin.id)).status).toBe(200);
    expect((await readTask(f.task.id))?.userId).toBe(f.admin.id);
  });

  it("cancels a pending request when the assignee changes", async () => {
    const f = await changeRequestFixture();
    const requestId = await requestStatus(f.outsider, f.task.id, "in-progress");
    await grantAssign(f.workspace.id, [f.creator.id]);
    expect((await assign(f.creator, f.task.id, f.creator.id)).status).toBe(200);
    expect(await readRequest(requestId)).toMatchObject({
      state: "cancelled",
      reason: "task_changed",
    });
  });
});
