import { eq } from "drizzle-orm";
import { beforeEach, expect, it, vi } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { publishEvent, subscribeToEvent } from "../../apps/api/src/events";
import { enqueueEvent } from "../../apps/api/src/events/outbox/enqueue";
import updateTaskStatus from "../../apps/api/src/task/controllers/update-task-status";
import { resetTestDatabase } from "./helpers/database";
import { outboxTaskFixture, readOutbox } from "./helpers/outbox";
import { logger } from "../../apps/api/src/observability/logger";

beforeEach(resetTestDatabase);

it("stamps each row with the workspace of the task's project", async () => {
  const a = await outboxTaskFixture();
  const b = await outboxTaskFixture();
  await updateTaskStatus({
    id: a.task.id,
    status: "done",
    currentUserId: a.user.id,
  });
  await updateTaskStatus({
    id: b.task.id,
    status: "done",
    currentUserId: b.user.id,
  });
  const rows = await readOutbox();
  expect(
    Object.fromEntries(
      rows.map((row) => [
        (row.payload as { taskId: string }).taskId,
        row.workspaceId,
      ]),
    ),
  ).toEqual({ [a.task.id]: a.workspace.id, [b.task.id]: b.workspace.id });
});

it("purges a workspace's rows when the workspace is deleted", async () => {
  const gone = await outboxTaskFixture();
  const kept = await outboxTaskFixture();
  await updateTaskStatus({
    id: gone.task.id,
    status: "done",
    currentUserId: gone.user.id,
  });
  await updateTaskStatus({
    id: kept.task.id,
    status: "done",
    currentUserId: kept.user.id,
  });

  await db
    .delete(schema.workspaceTable)
    .where(eq(schema.workspaceTable.id, gone.workspace.id));

  expect((await readOutbox()).map((row) => row.workspaceId)).toEqual([
    kept.workspace.id,
  ]);
});

it("refuses a row whose project resolves to no workspace", async () => {
  await expect(
    enqueueEvent(db, "task.status_changed", {
      taskId: "t",
      projectId: "missing-project",
      type: "status_changed",
    }),
  ).rejects.toThrow();
  expect(await readOutbox()).toHaveLength(0);
});

it("keeps the description and the task row out of the payload", async () => {
  const { user, task, project } = await outboxTaskFixture();
  await publishEvent("task.created", {
    ...task,
    description: "private body text",
    taskId: task.id,
    projectId: project.id,
    currentUserId: user.id,
    type: "created",
  });
  const [row] = await readOutbox();
  expect(row?.payload).toEqual({
    v: 1,
    taskId: task.id,
    projectId: project.id,
    userId: user.id,
    activityType: "created",
    eventData: {},
  });
});

it("logs a bridge failure without the payload and still reaches live subscribers", async () => {
  const log = vi.spyOn(logger, "error").mockImplementation(() => {});
  const live = vi.fn(async () => undefined);
  await subscribeToEvent("task.status_changed", live);
  await publishEvent("task.status_changed", {
    taskId: "task-x",
    projectId: "missing-project",
    title: "private title",
    type: "status_changed",
  });
  expect(await readOutbox()).toHaveLength(0);
  expect(live).toHaveBeenCalledWith(
    expect.objectContaining({ taskId: "task-x", title: "private title" }),
  );
  const logged = JSON.stringify(log.mock.calls);
  expect(logged).toContain("task.status_changed");
  expect(logged).not.toContain("private title");
  expect(logged).not.toContain("missing-project");
});
