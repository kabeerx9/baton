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
import {
  answer,
  as,
  changeRequestFixture,
  outcomeNotifications,
  readTask,
  requestStatus,
} from "./helpers/change-requests";
import { resetTestDatabase } from "./helpers/database";

// B8: once a task is deleted, its requests answer with taskId null and the
// requester still hears the outcome.

beforeEach(resetTestDatabase);
afterEach(() => vi.restoreAllMocks());

describe("requests after a delete", () => {
  it("answers an accepted delete like a later GET and notifies the requester", async () => {
    const f = await changeRequestFixture();
    const requested = await as(f.outsider)(`/api/task/${f.task.id}`, {
      method: "DELETE",
    });
    expect(requested.status).toBe(202);
    const requestId = (await requested.json()).request.id as string;

    const accepted = await answer(f.admin, requestId, "accept");
    expect(accepted.status).toBe(200);
    const body = await accepted.json();
    expect(body).toMatchObject({
      request: { state: "accepted", taskId: null },
      task: null,
    });
    expect(await readTask(f.task.id)).toBeUndefined();

    const read = await as(f.admin)(`/api/task-change-request/${requestId}`);
    expect(read.status).toBe(200);
    expect(await read.json()).toEqual(body.request);

    const notices = await outcomeNotifications(f.outsider.id);
    expect(notices).toEqual([
      expect.objectContaining({
        resourceType: "workspace",
        resourceId: f.workspace.id,
      }),
    ]);
  });

  it("notifies the requester when the task is deleted directly", async () => {
    const f = await changeRequestFixture();
    const requestId = await requestStatus(f.outsider, f.task.id, "in-progress");
    const deleted = await as(f.admin)(`/api/task/${f.task.id}`, {
      method: "DELETE",
    });
    expect(deleted.status).toBe(200);

    const row = await db.query.taskChangeRequestTable.findFirst({
      where: eq(schema.taskChangeRequestTable.id, requestId),
    });
    expect(row).toMatchObject({
      state: "cancelled",
      reason: "task_deleted",
      taskId: null,
    });
    expect(await outcomeNotifications(f.outsider.id)).toHaveLength(1);
  });
});
