import { and, eq } from "drizzle-orm";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { runChangeRequestTimeouts } from "../../apps/api/src/task-change-request/expire-change-requests";
import {
  answer,
  as,
  changeRequestFixture,
  makeDue,
  readRequest,
  readTask,
  requestStatus,
} from "./helpers/change-requests";
import { resetTestDatabase } from "./helpers/database";
import { drainOutbox } from "./helpers/outbox";

beforeEach(resetTestDatabase);
afterEach(() => vi.restoreAllMocks());

async function requestDelete(user: { id: string }, taskId: string) {
  const response = await as(user)(`/api/task/${taskId}`, { method: "DELETE" });
  expect(response.status).toBe(202);
  return ((await response.json()) as { request: { id: string } }).request.id;
}

describe("timeouts", () => {
  it("applies a non-final status request and credits the requester", async () => {
    const f = await changeRequestFixture();
    const requestId = await requestStatus(f.outsider, f.task.id, "in-progress");
    await makeDue(requestId);

    expect(await runChangeRequestTimeouts()).toMatchObject({ applied: 1 });
    expect(await readRequest(requestId)).toMatchObject({
      state: "applied_on_timeout",
      decidedBy: null,
    });
    expect((await readTask(f.task.id))?.status).toBe("in-progress");
    await drainOutbox();
    const [activity] = await db
      .select()
      .from(schema.activityTable)
      .where(
        and(
          eq(schema.activityTable.taskId, f.task.id),
          eq(schema.activityTable.type, "status_changed"),
        ),
      );
    expect(activity).toMatchObject({ userId: f.outsider.id });
  });

  it.each(["done", "archived"])(
    "expires a request into %s instead of applying it",
    async (target) => {
      const f = await changeRequestFixture();
      const requestId = await requestStatus(f.outsider, f.task.id, target);
      await makeDue(requestId);
      expect(await runChangeRequestTimeouts()).toMatchObject({ expired: 1 });
      expect((await readRequest(requestId))?.state).toBe("expired");
      expect((await readTask(f.task.id))?.status).toBe("to-do");
    },
  );

  it("expires a delete request and keeps the task", async () => {
    const f = await changeRequestFixture();
    const requestId = await requestDelete(f.outsider, f.task.id);
    await makeDue(requestId);
    expect(await runChangeRequestTimeouts()).toMatchObject({ expired: 1 });
    expect((await readRequest(requestId))?.state).toBe("expired");
    expect(await readTask(f.task.id)).toBeDefined();
  });

  it("leaves requests that are not yet due", async () => {
    const f = await changeRequestFixture();
    const requestId = await requestStatus(f.outsider, f.task.id, "in-progress");
    expect(await runChangeRequestTimeouts()).toMatchObject({
      applied: 0,
      expired: 0,
    });
    expect((await readRequest(requestId))?.state).toBe("pending");
  });

  it("cancels a due request whose task changed since it was made", async () => {
    const f = await changeRequestFixture();
    const requestId = await requestStatus(f.outsider, f.task.id, "in-progress");
    await db
      .update(schema.taskTable)
      .set({ status: "in-review", statusGeneration: 1 })
      .where(eq(schema.taskTable.id, f.task.id));
    await makeDue(requestId);
    expect(await runChangeRequestTimeouts()).toMatchObject({ cancelled: 1 });
    expect(await readRequest(requestId)).toMatchObject({
      state: "cancelled",
      reason: "task_changed",
    });
    expect((await readTask(f.task.id))?.status).toBe("in-review");
  });
});

describe("accepting", () => {
  it("persists the cancellation when the change is refused at apply time", async () => {
    const f = await changeRequestFixture();
    const requestId = await requestStatus(f.outsider, f.task.id, "done");
    const [blocker] = await db
      .insert(schema.taskTable)
      .values({
        projectId: f.project.id,
        columnId: f.columns.todo.id,
        title: "Blocker",
        status: "to-do",
        number: 2,
      })
      .returning();
    await db.insert(schema.taskRelationTable).values({
      sourceTaskId: blocker.id,
      targetTaskId: f.task.id,
      relationType: "blocks",
    });

    const response = await answer(f.creator, requestId, "accept");
    expect(response.status).toBe(200);
    const row = await readRequest(requestId);
    expect(row?.state).toBe("cancelled");
    expect(row?.reason).toMatch(/^refused: /);
    expect(row?.decidedBy).toBe(f.creator.id);
    expect((await readTask(f.task.id))?.status).toBe("to-do");
  });

  it("deletes the task and keeps the request's history", async () => {
    const f = await changeRequestFixture();
    const requestId = await requestDelete(f.outsider, f.task.id);
    // The creator is a member without task:delete, so cannot accept.
    expect((await answer(f.creator, requestId, "accept")).status).toBe(403);

    const response = await answer(f.admin, requestId, "accept");
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      request: { state: "accepted" },
      task: null,
    });
    expect(await readTask(f.task.id)).toBeUndefined();

    const read = await as(f.outsider)(`/api/task-change-request/${requestId}`);
    expect(read.status).toBe(200);
    expect(await read.json()).toMatchObject({
      state: "accepted",
      taskId: null,
      taskKey: "API-1",
      taskTitle: "Ship the thing",
    });
  });

  it("replays a repeated accept and refuses a conflicting answer", async () => {
    const f = await changeRequestFixture();
    const requestId = await requestStatus(f.outsider, f.task.id, "in-progress");
    const first = await (await answer(f.creator, requestId, "accept")).json();
    const again = await answer(f.creator, requestId, "accept");
    expect(again.status).toBe(200);
    expect((await again.json()).request).toEqual(first.request);
    expect((await answer(f.creator, requestId, "reject")).status).toBe(409);

    await drainOutbox();
    const activities = await db
      .select()
      .from(schema.activityTable)
      .where(
        and(
          eq(schema.activityTable.taskId, f.task.id),
          eq(schema.activityTable.type, "status_changed"),
        ),
      );
    expect(activities).toHaveLength(1);
  });

  it("replays a repeated request instead of opening a second one", async () => {
    const f = await changeRequestFixture();
    const first = await requestStatus(f.outsider, f.task.id, "in-progress");
    const second = await requestStatus(f.outsider, f.task.id, "in-progress");
    expect(second).toBe(first);
    expect(await db.select().from(schema.taskChangeRequestTable)).toHaveLength(
      1,
    );
  });

  it("supersedes the pending request when another one is made", async () => {
    const f = await changeRequestFixture();
    const first = await requestStatus(f.outsider, f.task.id, "in-progress");
    const second = await requestStatus(f.outsider, f.task.id, "in-review");
    expect(second).not.toBe(first);
    expect((await readRequest(first))?.state).toBe("superseded");
    expect((await readRequest(second))?.state).toBe("pending");
  });
});
