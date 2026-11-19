import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { eventContext } from "../../apps/api/src/events";
import deleteTask from "../../apps/api/src/task/controllers/delete-task";
import createTaskRelation from "../../apps/api/src/task-relation/controllers/create-task-relation";
import deleteTaskRelation from "../../apps/api/src/task-relation/controllers/delete-task-relation";
import {
  addConnection,
  initializeWebSocketAdapter,
  removeConnection,
  shutdownWebSocketAdapter,
} from "../../apps/api/src/ws";
import { as } from "./helpers/change-requests";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";
import { addWorkspaceMember } from "./helpers/project-access/add-workspace-member";
import { restrictToProjects } from "./helpers/project-access/restrict-to-projects";

// A relation links two tasks; a board showing either one must hear about it,
// but each project's readers learn only that project's task.

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
  it("tell each project's readers only about that project's task", async () => {
    const member = await createWorkspaceMember({ role: "owner" });
    const source = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    const target = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    const sourceTask = await addTask(source.project.id, 1);
    const targetTask = await addTask(target.project.id, 1);
    // A viewer who may read only the target project.
    const viewer = await addWorkspaceMember(member.workspace.id, "viewer");
    await restrictToProjects(member.workspace.id, viewer.id, [
      target.project.id,
    ]);
    expect((await as(viewer)(`/api/task/${sourceTask.id}`)).status).toBe(403);

    await initializeWebSocketAdapter();
    const targetSend = vi.fn();
    const sourceSend = vi.fn();
    const targetConnection = addConnection(
      target.project.id,
      { send: targetSend } as never,
      viewer.id,
      "viewer-window",
      member.workspace.id,
    );
    const sourceConnection = addConnection(
      source.project.id,
      { send: sourceSend } as never,
      member.user.id,
      "owner-window",
      member.workspace.id,
    );
    const expectScoped = async () => {
      await vi.waitFor(() => {
        expect(relationMessages(targetSend)).toHaveLength(1);
        expect(relationMessages(sourceSend)).toHaveLength(1);
      });
      expect(relationMessages(targetSend)[0]).toEqual({
        type: "TASK_RELATION_UPDATED",
        projectId: target.project.id,
        taskId: targetTask.id,
        targetTaskId: targetTask.id,
      });
      expect(relationMessages(sourceSend)[0]).toEqual({
        type: "TASK_RELATION_UPDATED",
        projectId: source.project.id,
        taskId: sourceTask.id,
        sourceTaskId: sourceTask.id,
      });
      targetSend.mockClear();
      sourceSend.mockClear();
    };
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
      await expectScoped();
      await eventContext.run({ initiatorId: "initiator" }, () =>
        deleteTaskRelation(relation.id, member.user.id, member.workspace.id),
      );
      await expectScoped();

      // Deleting the source task refreshes the target board without naming it.
      await createTaskRelation({
        sourceTaskId: sourceTask.id,
        targetTaskId: targetTask.id,
        relationType: "blocks",
        userId: member.user.id,
        workspaceId: member.workspace.id,
      });
      await vi.waitFor(() =>
        expect(relationMessages(targetSend)).toHaveLength(1),
      );
      targetSend.mockClear();
      await eventContext.run({ initiatorId: "initiator" }, () =>
        deleteTask(sourceTask.id, member.user.id),
      );
      await vi.waitFor(() =>
        expect(relationMessages(targetSend)).toContainEqual({
          type: "TASK_RELATION_UPDATED",
          projectId: target.project.id,
          taskId: targetTask.id,
          targetTaskId: targetTask.id,
        }),
      );
      await new Promise((resolve) => setTimeout(resolve, 300));
      for (const [raw] of targetSend.mock.calls) {
        expect(raw as string).not.toContain(sourceTask.id);
      }
    } finally {
      removeConnection(target.project.id, targetConnection);
      removeConnection(source.project.id, sourceConnection);
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
