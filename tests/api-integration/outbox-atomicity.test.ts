import { eq, sql } from "drizzle-orm";
import { afterEach, beforeEach, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import updateTaskStatus from "../../apps/api/src/task/controllers/update-task-status";
import { resetTestDatabase } from "./helpers/database";
import {
  outboxTaskFixture,
  readActivities,
  readOutbox,
} from "./helpers/outbox";

beforeEach(resetTestDatabase);
afterEach(async () => {
  await db.execute(sql`DROP TRIGGER IF EXISTS outbox_test_fail ON outbox`);
  await db.execute(sql`DROP FUNCTION IF EXISTS outbox_test_fail()`);
});

it("writes the activity row in the status change's transaction", async () => {
  const { user, task, workspace } = await outboxTaskFixture();

  const result = await updateTaskStatus({
    id: task.id,
    status: "in-progress",
    currentUserId: user.id,
  });

  expect(result.outcome).toBe("applied");
  // No relay ran: the row is the only record of the activity so far.
  expect(await readActivities(task.id)).toHaveLength(0);
  expect(await readOutbox()).toEqual([
    expect.objectContaining({
      type: "task.status_changed",
      consumer: "activity",
      workspaceId: workspace.id,
      state: "pending",
      attempts: 0,
      initiatorId: null,
      payload: {
        v: 1,
        taskId: task.id,
        projectId: task.projectId,
        userId: user.id,
        activityType: "status_changed",
        eventData: { oldStatus: "to-do", newStatus: "in-progress" },
      },
    }),
  ]);
});

it("leaves neither the status nor a row when the transaction rolls back", async () => {
  const { user, task } = await outboxTaskFixture();
  // Fail the outbox insert itself. If the row were written outside the
  // domain transaction, the status change would still commit.
  await db.execute(sql`
    CREATE FUNCTION outbox_test_fail() RETURNS trigger AS $$
    BEGIN RAISE EXCEPTION 'outbox insert refused'; END;
    $$ LANGUAGE plpgsql`);
  await db.execute(sql`
    CREATE TRIGGER outbox_test_fail BEFORE INSERT ON outbox
    FOR EACH ROW EXECUTE FUNCTION outbox_test_fail()`);

  await expect(
    updateTaskStatus({ id: task.id, status: "done", currentUserId: user.id }),
  ).rejects.toThrow();

  const [stored] = await db
    .select({ status: schema.taskTable.status })
    .from(schema.taskTable)
    .where(eq(schema.taskTable.id, task.id));
  expect(stored?.status).toBe("to-do");
  expect(await readOutbox()).toHaveLength(0);
  expect(await readActivities(task.id)).toHaveLength(0);
});

it("writes no row for a request that leaves the status unchanged", async () => {
  const { user, task } = await outboxTaskFixture();
  await updateTaskStatus({
    id: task.id,
    status: "to-do",
    currentUserId: user.id,
  });
  expect(await readOutbox()).toHaveLength(0);
});
