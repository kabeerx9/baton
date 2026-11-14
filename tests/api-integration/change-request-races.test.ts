import { and, eq, inArray } from "drizzle-orm";
import type { PoolClient } from "pg";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import db, { getDatabasePool, schema } from "../../apps/api/src/database";
import {
  runChangeRequestTimeouts,
  timeOutRequest,
} from "../../apps/api/src/task-change-request/expire-change-requests";
import {
  answer,
  changeRequestFixture,
  makeDue,
  readRequest,
  readTask,
  requestStatus,
  setStatus,
} from "./helpers/change-requests";
import { resetTestDatabase } from "./helpers/database";
import { addWorkspaceMember } from "./helpers/project-access/add-workspace-member";

// Each test holds a row lock on a second, raw connection to force one
// interleaving, then checks the outcome the lock order promises.

let holder: PoolClient | undefined;

beforeEach(resetTestDatabase);
afterEach(async () => {
  vi.restoreAllMocks();
  if (holder) {
    await holder.query("ROLLBACK").catch(() => undefined);
    holder.release();
    holder = undefined;
  }
});

async function lockTaskOnSecondConnection(taskId: string) {
  holder = await getDatabasePool().connect();
  await holder.query("BEGIN");
  await holder.query("SELECT id FROM task WHERE id = $1 FOR UPDATE", [taskId]);
  return holder;
}

/** Waits until `count` other sessions are blocked on a lock. */
async function waitForLockWaiters(count = 1) {
  for (let attempt = 0; attempt < 400; attempt++) {
    const { rows } = await getDatabasePool().query<{ waiting: number }>(
      `SELECT count(*)::int AS waiting FROM pg_stat_activity
       WHERE datname = current_database() AND wait_event_type = 'Lock'`,
    );
    if ((rows[0]?.waiting ?? 0) >= count) return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error("No session waited on the lock");
}

async function statusActivities(taskIds: string[]) {
  return db
    .select()
    .from(schema.activityTable)
    .where(
      and(
        inArray(schema.activityTable.taskId, taskIds),
        eq(schema.activityTable.type, "status_changed"),
      ),
    );
}

describe("two-connection races", () => {
  it("cancels an accept that waited behind a direct status write", async () => {
    const f = await changeRequestFixture();
    const requestId = await requestStatus(f.outsider, f.task.id, "in-progress");
    const lock = await lockTaskOnSecondConnection(f.task.id);

    const accepting = answer(f.creator, requestId, "accept");
    await waitForLockWaiters();
    await lock.query(
      `UPDATE task SET status = 'in-review',
         status_generation = status_generation + 1 WHERE id = $1`,
      [f.task.id],
    );
    await lock.query("COMMIT");

    const response = await accepting;
    expect(response.status).toBe(200);
    expect(await readRequest(requestId)).toMatchObject({
      state: "cancelled",
      reason: "task_changed",
    });
    expect((await readTask(f.task.id))?.status).toBe("in-review");
  });

  it("lets a waiting accept win while the timeout job skips the busy task", async () => {
    const f = await changeRequestFixture();
    const requestId = await requestStatus(f.outsider, f.task.id, "in-progress");
    await makeDue(requestId);
    const lock = await lockTaskOnSecondConnection(f.task.id);

    const accepting = answer(f.creator, requestId, "accept");
    await waitForLockWaiters();
    expect(await timeOutRequest(requestId)).toBe("skipped");
    await lock.query("COMMIT");

    expect((await accepting).status).toBe(200);
    expect((await readRequest(requestId))?.state).toBe("accepted");
    expect(await runChangeRequestTimeouts()).toMatchObject({
      applied: 0,
      expired: 0,
    });
    expect(await statusActivities([f.task.id])).toHaveLength(1);
  });

  it("ends a request exactly once when accept and the timeout run together", async () => {
    const f = await changeRequestFixture();
    const requestId = await requestStatus(f.outsider, f.task.id, "in-progress");
    await makeDue(requestId);

    const [accepted] = await Promise.all([
      answer(f.creator, requestId, "accept"),
      runChangeRequestTimeouts(),
    ]);
    expect([200, 409]).toContain(accepted.status);
    expect(["accepted", "applied_on_timeout"]).toContain(
      (await readRequest(requestId))?.state,
    );
    expect((await readTask(f.task.id))?.status).toBe("in-progress");
    expect(await statusActivities([f.task.id])).toHaveLength(1);
  });

  it("applies each due request once when two timeout runs overlap", async () => {
    const tasks = [];
    const requests = [];
    for (const slug of ["A", "B", "C"]) {
      const f = await changeRequestFixture(slug);
      tasks.push(f.task.id);
      requests.push(await requestStatus(f.outsider, f.task.id, "in-progress"));
    }
    for (const id of requests) await makeDue(id);

    const runs = await Promise.all([
      runChangeRequestTimeouts(),
      runChangeRequestTimeouts(),
    ]);
    expect(runs[0].applied + runs[1].applied).toBe(3);
    expect(runs.some((run) => run.degraded)).toBe(false);
    for (const id of requests)
      expect((await readRequest(id))?.state).toBe("applied_on_timeout");
    expect(await statusActivities(tasks)).toHaveLength(3);
  });

  it("keeps one pending request when two outsiders ask at once", async () => {
    const f = await changeRequestFixture();
    const second = await addWorkspaceMember(f.workspace.id);
    const lock = await lockTaskOnSecondConnection(f.task.id);

    const asking = Promise.all([
      setStatus(f.outsider, f.task.id, "in-progress"),
      setStatus(second, f.task.id, "in-review"),
    ]);
    await waitForLockWaiters(2);
    await lock.query("COMMIT");
    const responses = await asking;
    expect(responses.map((response) => response.status)).toEqual([202, 202]);

    const rows = await db
      .select()
      .from(schema.taskChangeRequestTable)
      .where(eq(schema.taskChangeRequestTable.taskId, f.task.id));
    expect(rows.map((row) => row.state).sort()).toEqual([
      "pending",
      "superseded",
    ]);
  });

  it("replays one request when the same person asks twice at once", async () => {
    const f = await changeRequestFixture();
    const [a, b] = await Promise.all([
      setStatus(f.outsider, f.task.id, "in-progress"),
      setStatus(f.outsider, f.task.id, "in-progress"),
    ]);
    const ids = await Promise.all(
      [a, b].map(async (response) => (await response.json()).request.id),
    );
    expect(ids[0]).toBe(ids[1]);
    expect(await db.select().from(schema.taskChangeRequestTable)).toHaveLength(
      1,
    );
  });

  it("cancels a due request whose workspace is archived while it waits", async () => {
    const f = await changeRequestFixture();
    const requestId = await requestStatus(f.outsider, f.task.id, "in-progress");
    await makeDue(requestId);
    holder = await getDatabasePool().connect();
    await holder.query("BEGIN");
    await holder.query(
      "UPDATE workspace SET archived_at = now() WHERE id = $1",
      [f.workspace.id],
    );

    const timingOut = timeOutRequest(requestId);
    await waitForLockWaiters();
    await holder.query("COMMIT");

    expect(await timingOut).toBe("cancelled");
    expect(await readRequest(requestId)).toMatchObject({
      state: "cancelled",
      reason: "workspace_archived",
    });
    expect((await readTask(f.task.id))?.status).toBe("to-do");
  });

  it("lets a request and a reorder that holds the project both finish", async () => {
    const f = await changeRequestFixture();
    holder = await getDatabasePool().connect();
    await holder.query("BEGIN");
    // A reorder's order: the project first, then its tasks.
    await holder.query("SELECT id FROM project WHERE id = $1 FOR UPDATE", [
      f.project.id,
    ]);

    const asking = setStatus(f.outsider, f.task.id, "in-progress");
    await waitForLockWaiters();
    // The request waits on the project, so it holds no task lock yet.
    await holder.query("SELECT id FROM task WHERE id = $1 FOR UPDATE", [
      f.task.id,
    ]);
    await holder.query("UPDATE task SET position = 7 WHERE id = $1", [
      f.task.id,
    ]);
    await holder.query("COMMIT");

    const response = await asking;
    expect(response.status).toBe(202);
    expect((await readTask(f.task.id))?.position).toBe(7);
    expect((await readRequest((await response.json()).request.id))?.state).toBe(
      "pending",
    );
  });

  it("lets only one of two requests on different tasks pass the hourly limit", async () => {
    const f = await changeRequestFixture();
    const tasks = await db
      .insert(schema.taskTable)
      .values(
        Array.from({ length: 11 }, (_, index) => ({
          projectId: f.project.id,
          columnId: f.columns.todo.id,
          title: `Task ${index + 2}`,
          status: "to-do",
          number: index + 2,
          position: index + 2,
          createdBy: f.creator.id,
        })),
      )
      .returning();
    for (const task of tasks.slice(0, 9))
      await requestStatus(f.outsider, task.id, "in-progress");

    holder = await getDatabasePool().connect();
    await holder.query("BEGIN");
    await holder.query(
      "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
      [`task-change-request:${f.workspace.id}:${f.outsider.id}`],
    );
    const asking = Promise.all(
      tasks
        .slice(9)
        .map((task) => setStatus(f.outsider, task.id, "in-progress")),
    );
    await waitForLockWaiters(2);
    await holder.query("COMMIT");

    const statuses = (await asking).map((response) => response.status).sort();
    expect(statuses).toEqual([202, 429]);
    expect(await db.select().from(schema.taskChangeRequestTable)).toHaveLength(
      10,
    );
  });
});
