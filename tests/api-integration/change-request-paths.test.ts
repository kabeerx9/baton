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
import { updateTaskStatus as setStatusFromGitHub } from "../../apps/api/src/plugins/github/services/task-service";
import {
  as,
  changeRequestFixture,
  readRequest,
  readTask,
  requestStatus,
} from "./helpers/change-requests";
import { resetTestDatabase } from "./helpers/database";
import { createProjectFixture } from "./helpers/fixtures";

beforeEach(resetTestDatabase);
afterEach(() => vi.restoreAllMocks());

async function blockTask(f: Awaited<ReturnType<typeof changeRequestFixture>>) {
  const [blocker] = await db
    .insert(schema.taskTable)
    .values({
      projectId: f.project.id,
      columnId: f.columns.todo.id,
      title: "Blocker",
      status: "to-do",
      number: 2,
      position: 2,
      createdBy: f.creator.id,
    })
    .returning();
  await db.insert(schema.taskRelationTable).values({
    sourceTaskId: blocker.id,
    targetTaskId: f.task.id,
    relationType: "blocks",
  });
  return blocker;
}

describe("paths that never create a request", () => {
  it("refuses an outsider's cross-column reorder but allows reordering in place", async () => {
    const f = await changeRequestFixture();
    const reorder = (status?: string) =>
      as(f.outsider)("/api/task/reorder", {
        method: "POST",
        body: JSON.stringify({
          projectId: f.project.id,
          tasks: [
            { id: f.task.id, position: 0, ...(status ? { status } : {}) },
          ],
        }),
      });
    expect((await reorder("in-progress")).status).toBe(409);
    expect((await readTask(f.task.id))?.status).toBe("to-do");
    expect((await reorder()).status).toBe(200);
    expect((await readTask(f.task.id))?.position).toBe(0);
    expect(await db.select().from(schema.taskChangeRequestTable)).toEqual([]);
  });

  it("reports per-item results for a bulk status change", async () => {
    const f = await changeRequestFixture();
    const [mine] = await db
      .insert(schema.taskTable)
      .values({
        projectId: f.project.id,
        columnId: f.columns.todo.id,
        title: "Mine",
        status: "to-do",
        number: 2,
        createdBy: f.outsider.id,
      })
      .returning();
    const response = await as(f.outsider)("/api/task/bulk", {
      method: "PATCH",
      body: JSON.stringify({
        taskIds: [f.task.id, mine.id],
        operation: "updateStatus",
        value: "in-progress",
      }),
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.updatedCount).toBe(1);
    expect(body.results).toEqual(
      expect.arrayContaining([
        { taskId: mine.id, outcome: "applied" },
        expect.objectContaining({ taskId: f.task.id, outcome: "refused" }),
      ]),
    );
    expect((await readTask(f.task.id))?.status).toBe("to-do");
    expect((await readTask(mine.id))?.status).toBe("in-progress");
    expect(await db.select().from(schema.taskChangeRequestTable)).toEqual([]);
  });

  it("refuses an outsider's project move that changes the status", async () => {
    const f = await changeRequestFixture();
    const destination = await createProjectFixture({
      workspaceId: f.workspace.id,
    });
    const response = await as(f.outsider)(`/api/task/move/${f.task.id}`, {
      method: "PUT",
      body: JSON.stringify({
        destinationProjectId: destination.project.id,
        destinationStatus: "in-progress",
      }),
    });
    expect(response.status).toBe(409);
    expect((await readTask(f.task.id))?.projectId).toBe(f.project.id);
  });

  it("refuses finishing a blocked task on person paths", async () => {
    const f = await changeRequestFixture();
    await blockTask(f);
    const response = await as(f.creator)(`/api/task/status/${f.task.id}`, {
      method: "PUT",
      body: JSON.stringify({ status: "done" }),
    });
    expect(response.status).toBe(409);
  });
});

describe("board and system paths", () => {
  it("keeps the outcome on a board item update", async () => {
    const f = await changeRequestFixture("T");
    await db
      .update(schema.projectTable)
      .set({ kind: "board" })
      .where(eq(schema.projectTable.id, f.project.id));
    const update = (user: { id: string }, status: string) =>
      as(user)(`/api/board/workspace/${f.workspace.id}/item/T-1`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
    const requested = await update(f.outsider, "in progress");
    expect(requested.status).toBe(202);
    const body = await requested.json();
    expect(body).toMatchObject({
      outcome: "requested",
      request: { kind: "status", state: "pending" },
    });

    const board = await (
      await as(f.creator)(`/api/board/workspace/${f.workspace.id}`)
    ).json();
    const item = board.tasks.find(
      (entry: { id: string }) => entry.id === f.task.id,
    );
    expect(item.pendingRequest).toMatchObject({ id: body.request.id });

    const applied = await update(f.assignee, "review");
    expect(applied.status).toBe(200);
    expect(await applied.json()).toMatchObject({ outcome: "applied" });
    expect(await readRequest(body.request.id)).toMatchObject({
      state: "cancelled",
      reason: "task_changed",
    });
  });

  it("applies a webhook done on a blocked task and cancels the pending request", async () => {
    const f = await changeRequestFixture();
    await blockTask(f);
    const requestId = await requestStatus(f.outsider, f.task.id, "in-progress");
    const before = await readTask(f.task.id);

    expect(await setStatusFromGitHub(f.task.id, "done")).toMatchObject({
      applied: true,
    });
    const after = await readTask(f.task.id);
    expect(after?.status).toBe("done");
    expect(after?.statusGeneration).toBe((before?.statusGeneration ?? 0) + 1);
    expect(await readRequest(requestId)).toMatchObject({
      state: "cancelled",
      reason: "task_changed",
    });
  });

  it("does not bump the generation for a write that keeps the status", async () => {
    const f = await changeRequestFixture();
    await setStatusFromGitHub(f.task.id, "to-do");
    expect((await readTask(f.task.id))?.statusGeneration).toBe(0);
    await db
      .update(schema.taskTable)
      .set({ title: "Renamed" })
      .where(eq(schema.taskTable.id, f.task.id));
    expect((await readTask(f.task.id))?.statusGeneration).toBe(0);
  });
});
