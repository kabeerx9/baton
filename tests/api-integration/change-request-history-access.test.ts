import { eq } from "drizzle-orm";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import moveProject from "../../apps/api/src/project/controllers/move-project";
import {
  answer,
  changeRequestFixture,
  createKey,
  moveToNewWorkspace,
  requestStatus,
  withKey,
} from "./helpers/change-requests";
import { resetTestDatabase } from "./helpers/database";
import { createProjectFixture } from "./helpers/fixtures";
import { restrictToProjects } from "./helpers/project-access/restrict-to-projects";

// B1: reading a request's history never grants reading its current task.

beforeEach(resetTestDatabase);
afterEach(() => vi.restoreAllMocks());

async function hideProjectFrom(
  f: Awaited<ReturnType<typeof changeRequestFixture>>,
  userId: string,
) {
  const other = await createProjectFixture({ workspaceId: f.workspace.id });
  await restrictToProjects(f.workspace.id, userId, [other.project.id]);
}

function cancelWithKey(key: string, requestId: string) {
  return withKey(key)(`/api/task-change-request/${requestId}/cancel`, {
    method: "POST",
  });
}

describe("decisions after the caller lost the task", () => {
  it("returns task null on cancel and replay after lost project access", async () => {
    const f = await changeRequestFixture();
    const requestId = await requestStatus(f.outsider, f.task.id, "in-progress");
    await hideProjectFrom(f, f.outsider.id);

    const cancelled = await answer(f.outsider, requestId, "cancel");
    expect(cancelled.status).toBe(200);
    expect(await cancelled.json()).toMatchObject({
      request: { state: "cancelled", reason: "withdrawn" },
      task: null,
    });

    const replay = await answer(f.outsider, requestId, "cancel");
    expect(replay.status).toBe(200);
    expect(await replay.json()).toMatchObject({
      request: { state: "cancelled" },
      task: null,
    });

    const { key } = await createKey(f.outsider.id, { task: ["read"] });
    const keyReplay = await cancelWithKey(key, requestId);
    expect(keyReplay.status).toBe(200);
    expect((await keyReplay.json()).task).toBeNull();
  });

  it("returns task null on replay after the project moved to another workspace", async () => {
    const f = await changeRequestFixture();
    const requestId = await requestStatus(f.outsider, f.task.id, "in-progress");
    const withdrawn = await answer(f.outsider, requestId, "cancel");
    expect((await withdrawn.json()).task).toMatchObject({ id: f.task.id });

    const [target] = await db
      .insert(schema.workspaceTable)
      .values({
        id: "workspace-target",
        name: "Target",
        slug: "target",
        createdAt: new Date(),
      })
      .returning();
    await db.insert(schema.workspaceUserTable).values({
      workspaceId: target.id,
      userId: f.creator.id,
      role: "owner",
      joinedAt: new Date(),
    });
    await moveProject(f.project.id, f.workspace.id, target.id, f.creator.id);

    const replay = await answer(f.outsider, requestId, "cancel");
    expect(replay.status).toBe(200);
    expect(await replay.json()).toMatchObject({
      request: { state: "cancelled" },
      task: null,
    });
    const { key } = await createKey(f.outsider.id, { task: ["read"] });
    expect(
      (await (await cancelWithKey(key, requestId)).json()).task,
    ).toBeNull();
  });

  it("returns task null on replay when the destination workspace is archived", async () => {
    const f = await changeRequestFixture();
    const requestId = await requestStatus(f.outsider, f.task.id, "in-progress");
    expect((await answer(f.outsider, requestId, "cancel")).status).toBe(200);
    // The requester stays a member where the project goes.
    const target = await moveToNewWorkspace(f, f.creator, [f.outsider]);

    const visible = await answer(f.outsider, requestId, "cancel");
    expect((await visible.json()).task).toMatchObject({ id: f.task.id });

    await db
      .update(schema.workspaceTable)
      .set({ archivedAt: new Date() })
      .where(eq(schema.workspaceTable.id, target.id));
    const replay = await answer(f.outsider, requestId, "cancel");
    expect(replay.status).toBe(200);
    expect(await replay.json()).toMatchObject({
      request: { state: "cancelled" },
      task: null,
    });
  });

  it("refuses a replay by anyone but the original decider", async () => {
    const f = await changeRequestFixture();
    const requestId = await requestStatus(f.outsider, f.task.id, "in-progress");
    expect((await answer(f.creator, requestId, "reject")).status).toBe(200);

    expect((await answer(f.assignee, requestId, "reject")).status).toBe(409);
    const { key } = await createKey(f.admin.id, { task: ["read"] });
    const keyReplay = await withKey(key)(
      `/api/task-change-request/${requestId}/reject`,
      { method: "POST" },
    );
    expect(keyReplay.status).toBe(409);
    expect(await keyReplay.json()).toMatchObject({ code: "REQUEST_DECIDED" });

    const own = await answer(f.creator, requestId, "reject");
    expect(own.status).toBe(200);
    expect((await own.json()).task).toMatchObject({ id: f.task.id });
    const row = await db.query.taskChangeRequestTable.findFirst({
      where: eq(schema.taskChangeRequestTable.id, requestId),
    });
    expect(row?.decidedBy).toBe(f.creator.id);
  });
});
