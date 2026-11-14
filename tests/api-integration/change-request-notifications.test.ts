import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { updateTaskStatus as setStatusFromGitHub } from "../../apps/api/src/plugins/github/services/task-service";
import createTaskRelation from "../../apps/api/src/task-relation/controllers/create-task-relation";
import updateMemberProjectAccess from "../../apps/api/src/workspace/controllers/update-member-project-access";
import {
  changeRequestFixture,
  outcomeNotifications,
  readRequest,
  readTask,
  requestStatus,
} from "./helpers/change-requests";
import { resetTestDatabase } from "./helpers/database";
import { createProjectFixture } from "./helpers/fixtures";

// N3: every path that cancels a request tells the requester, after commit.

beforeEach(resetTestDatabase);
afterEach(() => vi.restoreAllMocks());

async function expectNotifiedOnce(
  requestId: string,
  requesterId: string,
  reason: string,
) {
  expect(await readRequest(requestId)).toMatchObject({
    state: "cancelled",
    reason,
  });
  const notices = await outcomeNotifications(requesterId);
  expect(notices).toHaveLength(1);
  expect(notices[0]?.eventData).toMatchObject({ requestId });
}

describe("cancellation notifications", () => {
  it("notifies the requester when a webhook changes the status", async () => {
    const f = await changeRequestFixture();
    const requestId = await requestStatus(f.outsider, f.task.id, "in-progress");
    await setStatusFromGitHub(f.task.id, "done");
    expect((await readTask(f.task.id))?.status).toBe("done");
    await expectNotifiedOnce(requestId, f.outsider.id, "task_changed");
  });

  it("notifies the requester when the task becomes a feature", async () => {
    const f = await changeRequestFixture();
    const requestId = await requestStatus(f.outsider, f.task.id, "in-progress");
    const [child] = await db
      .insert(schema.taskTable)
      .values({
        projectId: f.project.id,
        columnId: f.columns.todo.id,
        title: "Child",
        status: "to-do",
        number: 2,
        position: 2,
        createdBy: f.creator.id,
      })
      .returning();
    await createTaskRelation({
      sourceTaskId: f.task.id,
      targetTaskId: child.id,
      relationType: "subtask",
      userId: f.creator.id,
      workspaceId: f.workspace.id,
    });
    await expectNotifiedOnce(requestId, f.outsider.id, "became_feature");
  });

  it("notifies the requester when an access change unassigns the task", async () => {
    const f = await changeRequestFixture();
    const requestId = await requestStatus(f.outsider, f.task.id, "in-progress");
    const other = await createProjectFixture({ workspaceId: f.workspace.id });
    await updateMemberProjectAccess({
      workspaceId: f.workspace.id,
      actorId: f.admin.id,
      userId: f.assignee.id,
      projectAccess: "selected",
      projectIds: [other.project.id],
    });
    expect((await readTask(f.task.id))?.userId).toBeNull();
    await expectNotifiedOnce(requestId, f.outsider.id, "task_changed");
  });
});
