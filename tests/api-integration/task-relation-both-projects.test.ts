import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { eventContext } from "../../apps/api/src/events";
import createTaskRelation from "../../apps/api/src/task-relation/controllers/create-task-relation";
import deleteTaskRelation from "../../apps/api/src/task-relation/controllers/delete-task-relation";
import {
  addConnection,
  initializeWebSocketAdapter,
  removeConnection,
  shutdownWebSocketAdapter,
} from "../../apps/api/src/ws";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

// A relation links two tasks; a board showing either one must hear about it.

beforeEach(resetTestDatabase);

async function addTask(projectId: string, number: number) {
  const [task] = await db
    .insert(schema.taskTable)
    .values({ projectId, title: "Task", status: "to-do", number })
    .returning();
  return task!;
}

function relationMessages(send: ReturnType<typeof vi.fn>) {
  return send.mock.calls
    .map(([raw]) => JSON.parse(raw as string))
    .filter((message) => message.type === "TASK_RELATION_UPDATED");
}

describe("task relation events", () => {
  it("reach a client subscribed only to the target task's project", async () => {
    const member = await createWorkspaceMember({ role: "owner" });
    const source = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    const target = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    const sourceTask = await addTask(source.project.id, 1);
    const targetTask = await addTask(target.project.id, 1);
    await initializeWebSocketAdapter();
    const send = vi.fn();
    const connection = addConnection(
      target.project.id,
      { send } as never,
      member.user.id,
      "other-window",
      member.workspace.id,
    );
    try {
      const relation = await eventContext.run(
        { initiatorId: "initiator" },
        () =>
          createTaskRelation({
            sourceTaskId: sourceTask.id,
            targetTaskId: targetTask.id,
            relationType: "blocks",
            userId: member.user.id,
            workspaceId: member.workspace.id,
          }),
      );
      await vi.waitFor(() => expect(relationMessages(send)).toHaveLength(1));
      expect(relationMessages(send)[0]).toMatchObject({
        projectId: target.project.id,
        sourceTaskId: sourceTask.id,
        targetTaskId: targetTask.id,
      });

      send.mockClear();
      await eventContext.run({ initiatorId: "initiator" }, () =>
        deleteTaskRelation(relation.id, member.user.id, member.workspace.id),
      );
      await vi.waitFor(() => expect(relationMessages(send)).toHaveLength(1));
      expect(relationMessages(send)[0]).toMatchObject({
        projectId: target.project.id,
        targetTaskId: targetTask.id,
      });
    } finally {
      removeConnection(target.project.id, connection);
      await shutdownWebSocketAdapter();
    }
  });

  it("sends one message when both tasks share a project", async () => {
    const member = await createWorkspaceMember({ role: "owner" });
    const { project } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    const first = await addTask(project.id, 1);
    const second = await addTask(project.id, 2);
    await initializeWebSocketAdapter();
    const send = vi.fn();
    const connection = addConnection(
      project.id,
      { send } as never,
      member.user.id,
      "other-window",
      member.workspace.id,
    );
    try {
      await eventContext.run({ initiatorId: "initiator" }, () =>
        createTaskRelation({
          sourceTaskId: first.id,
          targetTaskId: second.id,
          relationType: "blocks",
          userId: member.user.id,
          workspaceId: member.workspace.id,
        }),
      );
      await vi.waitFor(() => expect(relationMessages(send)).toHaveLength(1));
      // Let any duplicate broadcast flush before counting.
      await new Promise((resolve) => setTimeout(resolve, 300));
      expect(relationMessages(send)).toHaveLength(1);
    } finally {
      removeConnection(project.id, connection);
      await shutdownWebSocketAdapter();
    }
  });
});
