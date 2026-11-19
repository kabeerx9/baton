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
import { ensureBoardProject } from "../../apps/api/src/board/controllers/ensure-board-project";
import {
  answer,
  as,
  createKey,
  readTask,
  requestStatus,
  withKey,
} from "./helpers/change-requests";
import { resetTestDatabase } from "./helpers/database";
import { createWorkspaceMember } from "./helpers/fixtures";
import { addWorkspaceMember } from "./helpers/project-access/add-workspace-member";

// The viewer reads everything and works only on tasks assigned to them
// (task:update_assigned). Anything else is 403, never a change request.

vi.mock("../../apps/api/src/events", async (original) => {
  const events = await original<typeof import("../../apps/api/src/events")>();
  return {
    ...events,
    publishEvent: (...args: Parameters<typeof events.publishEvent>) =>
      events.publishEvent(args[0], args[1], { waitForHandlers: true }),
    publishLive: (...args: Parameters<typeof events.publishLive>) =>
      events.publishLive(args[0], args[1], { waitForHandlers: true }),
  };
});

beforeEach(resetTestDatabase);
afterEach(() => vi.restoreAllMocks());

type Send = ReturnType<typeof as>;
const json = (method: string, body: unknown): RequestInit => ({
  method,
  body: JSON.stringify(body),
});

/**
 * A board with `own` (assigned to the viewer) and `other` (assigned to a
 * member). The creator of both is `creator`; `member` is an outsider.
 */
async function seed(role = "viewer") {
  const { user: creator, workspace } = await createWorkspaceMember();
  const viewer = await addWorkspaceMember(workspace.id, role);
  const member = await addWorkspaceMember(workspace.id);
  const board = await ensureBoardProject(workspace.id);
  const insert = async (number: number, userId: string) => {
    const [task] = await db
      .insert(schema.taskTable)
      .values({
        projectId: board.id,
        number,
        position: number,
        title: `Task ${number}`,
        status: "to-do",
        createdBy: creator.id,
        userId,
      })
      .returning();
    return task;
  };
  const own = await insert(1, viewer.id);
  const other = await insert(2, member.id);
  const [label] = await db
    .insert(schema.labelTable)
    .values({ name: "bug", color: "red", workspaceId: workspace.id })
    .returning();
  return { workspace, board, creator, viewer, member, own, other, label };
}

async function requestCount() {
  return (await db.select().from(schema.taskChangeRequestTable)).length;
}

async function comments(taskId: string) {
  return db
    .select()
    .from(schema.activityTable)
    .where(eq(schema.activityTable.taskId, taskId));
}

/** Every single-task work call, as the viewer, against `taskId`. */
function workCalls(
  send: Send,
  f: Awaited<ReturnType<typeof seed>>,
  taskId: string,
) {
  return {
    status: () =>
      send(
        `/api/task/status/${taskId}`,
        json("PUT", { status: "in-progress" }),
      ),
    boardStatus: () =>
      send(
        `/api/board/workspace/${f.workspace.id}/item/${taskId}`,
        json("PATCH", { status: "in-progress" }),
      ),
    title: () =>
      send(`/api/task/title/${taskId}`, json("PUT", { title: "Renamed" })),
    description: () =>
      send(
        `/api/task/description/${taskId}`,
        json("PUT", { description: "New words" }),
      ),
    priority: () =>
      send(`/api/task/priority/${taskId}`, json("PUT", { priority: "high" })),
    dueDate: () =>
      send(
        `/api/task/due-date/${taskId}`,
        json("PUT", { dueDate: "2026-12-01T00:00:00.000Z" }),
      ),
    fullUpdate: async () => {
      const task = (await readTask(taskId))!;
      return send(
        `/api/task/${taskId}`,
        json("PUT", {
          title: "Rewritten",
          status: task.status,
          priority: task.priority ?? "no-priority",
          projectId: task.projectId,
          position: task.position ?? 0,
          userId: task.userId ?? undefined,
        }),
      );
    },
    comment: () =>
      send(`/api/comment/${taskId}`, json("POST", { content: "On it" })),
    activityComment: () =>
      send(
        "/api/activity/comment",
        json("POST", { taskId, comment: "Also on it" }),
      ),
    label: () => send(`/api/label/${f.label.id}/task`, json("PUT", { taskId })),
  };
}

describe("viewer on a task assigned to them", () => {
  it("applies status, board move, edits, comments and labels directly", async () => {
    const f = await seed();
    const send = as(f.viewer);
    const calls = workCalls(send, f, f.own.id);
    for (const [name, call] of Object.entries(calls)) {
      const response = await call();
      expect(response.status, name).toBe(200);
    }
    const task = await readTask(f.own.id);
    expect(task).toMatchObject({
      status: "in-progress",
      title: "Rewritten",
      description: "New words",
      priority: "high",
    });
    expect(await comments(f.own.id)).not.toHaveLength(0);
    expect(await requestCount()).toBe(0);
  });

  it("edits and deletes their own comment", async () => {
    const f = await seed();
    const send = as(f.viewer);
    const created = await send(
      `/api/comment/${f.own.id}`,
      json("POST", { content: "First" }),
    );
    const { id } = (await created.json()) as { id: string };
    expect(
      (await send(`/api/comment/${id}`, json("PUT", { content: "Second" })))
        .status,
    ).toBe(200);
    expect(
      (await send(`/api/comment/${id}`, { method: "DELETE" })).status,
    ).toBe(200);
  });

  it("removes a label from their own task", async () => {
    const f = await seed();
    const send = as(f.viewer);
    const attached = await send(
      `/api/label/${f.label.id}/task`,
      json("PUT", { taskId: f.own.id }),
    );
    const { id } = (await attached.json()) as { id: string };
    expect(
      (await send(`/api/label/${id}/task`, { method: "DELETE" })).status,
    ).toBe(200);
  });
});

describe("viewer on someone else's task", () => {
  it("refuses every work call with 403, changes nothing and opens no request", async () => {
    const f = await seed();
    const calls = workCalls(as(f.viewer), f, f.other.id);
    for (const [name, call] of Object.entries(calls)) {
      const response = await call();
      expect(response.status, name).toBe(403);
    }
    expect(await readTask(f.other.id)).toMatchObject({
      status: "to-do",
      title: "Task 2",
      description: null,
      dueDate: null,
    });
    expect(await comments(f.other.id)).toHaveLength(0);
    expect(
      await db
        .select()
        .from(schema.labelTable)
        .where(eq(schema.labelTable.taskId, f.other.id)),
    ).toHaveLength(0);
    expect(await requestCount()).toBe(0);
  });

  it("names the reason in the refusal", async () => {
    const f = await seed();
    const response = await workCalls(as(f.viewer), f, f.other.id).status();
    expect(await response.json()).toMatchObject({
      code: "NOT_ASSIGNED",
      message: "You can only change tasks assigned to you.",
    });
  });

  it("refuses edits and deletes of the viewer's own comment once the task is not theirs", async () => {
    const f = await seed();
    const send = as(f.viewer);
    const created = await send(
      `/api/comment/${f.own.id}`,
      json("POST", { content: "Mine" }),
    );
    const { id } = (await created.json()) as { id: string };
    await db
      .update(schema.taskTable)
      .set({ userId: f.member.id })
      .where(eq(schema.taskTable.id, f.own.id));
    expect(
      (await send(`/api/comment/${id}`, json("PUT", { content: "Edit" })))
        .status,
    ).toBe(403);
    expect(
      (await send(`/api/comment/${id}`, { method: "DELETE" })).status,
    ).toBe(403);
    expect(await comments(f.own.id)).toHaveLength(1);
  });

  it("refuses removing a label from someone else's task", async () => {
    const f = await seed();
    const [label] = await db
      .insert(schema.labelTable)
      .values({
        name: "bug",
        color: "red",
        workspaceId: f.workspace.id,
        taskId: f.other.id,
      })
      .returning();
    const send = as(f.viewer);
    expect(
      (await send(`/api/label/${label.id}/task`, { method: "DELETE" })).status,
    ).toBe(403);
    // Attaching a task's label row would move it off that task.
    expect(
      (
        await send(
          `/api/label/${label.id}/task`,
          json("PUT", { taskId: f.own.id }),
        )
      ).status,
    ).toBe(403);
    expect(
      await db
        .select()
        .from(schema.labelTable)
        .where(eq(schema.labelTable.taskId, f.other.id)),
    ).toHaveLength(1);
  });

  it("refuses a feature the viewer does not own; applies on one they do", async () => {
    const f = await seed();
    // `own` and `other` become features: each gets a subtask.
    for (const [parent, number] of [
      [f.own, 3],
      [f.other, 4],
    ] as const) {
      const [child] = await db
        .insert(schema.taskTable)
        .values({
          projectId: f.board.id,
          number,
          title: `Child ${number}`,
          createdBy: f.creator.id,
        })
        .returning();
      await db.insert(schema.taskRelationTable).values({
        sourceTaskId: parent.id,
        targetTaskId: child.id,
        relationType: "subtask",
      });
    }
    const send = as(f.viewer);
    expect((await workCalls(send, f, f.own.id).status()).status).toBe(200);
    expect((await workCalls(send, f, f.other.id).status()).status).toBe(403);
    expect(await requestCount()).toBe(0);
  });
});

describe("viewer never creates, deletes or assigns", () => {
  it("refuses create, delete, assign, unassign and self-assign", async () => {
    const f = await seed();
    const send = as(f.viewer);
    const refused: Record<string, Response> = {
      createBoardTask: await send(
        `/api/board/workspace/${f.workspace.id}`,
        json("POST", { title: "New" }),
      ),
      createSubtask: await send(
        `/api/board/${f.own.id}/subtask`,
        json("POST", { title: "Child" }),
      ),
      deleteOwn: await send(`/api/task/${f.own.id}`, { method: "DELETE" }),
      deleteOther: await send(`/api/task/${f.other.id}`, { method: "DELETE" }),
      giveAway: await send(
        `/api/task/assignee/${f.own.id}`,
        json("PUT", { userId: f.member.id }),
      ),
      unassign: await send(
        `/api/task/assignee/${f.own.id}`,
        json("PUT", { userId: null }),
      ),
      takeOther: await send(
        `/api/task/assignee/${f.other.id}`,
        json("PUT", { userId: f.viewer.id }),
      ),
      boardOwner: await send(
        `/api/board/workspace/${f.workspace.id}/item/${f.own.id}`,
        json("PATCH", { owner: f.member.name }),
      ),
      boardWaitsOn: await send(
        `/api/board/workspace/${f.workspace.id}/item/${f.own.id}`,
        json("PATCH", { waitsOn: [f.other.id] }),
      ),
    };
    for (const [name, response] of Object.entries(refused))
      expect(response.status, name).toBe(403);
    expect((await readTask(f.own.id))?.userId).toBe(f.viewer.id);
    expect((await readTask(f.other.id))?.userId).toBe(f.member.id);
    expect(await db.select().from(schema.taskRelationTable)).toHaveLength(0);
    expect(await requestCount()).toBe(0);
  });
});

describe("viewer on bulk and reorder", () => {
  it("bulk refuses each task not assigned to the viewer and applies the rest", async () => {
    const f = await seed();
    const send = as(f.viewer);
    for (const [operation, value] of [
      ["updateStatus", "in-progress"],
      ["updatePriority", "urgent"],
      ["updateDueDate", "2026-12-24T00:00:00.000Z"],
    ] as const) {
      const response = await send(
        "/api/task/bulk",
        json("PATCH", { taskIds: [f.own.id, f.other.id], operation, value }),
      );
      expect(response.status, operation).toBe(200);
      const body = (await response.json()) as {
        results: { taskId: string; outcome: string; reason?: string }[];
      };
      expect(body.results, operation).toEqual(
        expect.arrayContaining([
          { taskId: f.own.id, outcome: "applied" },
          {
            taskId: f.other.id,
            outcome: "refused",
            reason: "You can only change tasks assigned to you.",
          },
        ]),
      );
    }
    expect(await readTask(f.own.id)).toMatchObject({
      status: "in-progress",
      priority: "urgent",
    });
    expect(await readTask(f.other.id)).toMatchObject({
      status: "to-do",
      dueDate: null,
    });
    expect((await readTask(f.other.id))?.priority).not.toBe("urgent");
    expect(await requestCount()).toBe(0);
  });

  it("bulk delete and assign stay refused for the whole request", async () => {
    const f = await seed();
    const send = as(f.viewer);
    for (const operation of ["delete", "updateAssignee"])
      expect(
        (
          await send(
            "/api/task/bulk",
            json("PATCH", {
              taskIds: [f.own.id],
              operation,
              value: f.member.id,
            }),
          )
        ).status,
        operation,
      ).toBe(403);
  });

  it("reorder moves the viewer's own card and refuses a batch with another card", async () => {
    const f = await seed();
    const send = as(f.viewer);
    const ownOnly = await send(
      "/api/task/reorder",
      json("POST", {
        projectId: f.board.id,
        tasks: [{ id: f.own.id, position: 5, status: "in-progress" }],
      }),
    );
    expect(ownOnly.status).toBe(200);
    expect(await readTask(f.own.id)).toMatchObject({
      status: "in-progress",
      position: 5,
    });

    const mixed = await send(
      "/api/task/reorder",
      json("POST", {
        projectId: f.board.id,
        tasks: [
          { id: f.own.id, position: 1 },
          { id: f.other.id, position: 9 },
        ],
      }),
    );
    expect(mixed.status).toBe(403);
    expect((await readTask(f.own.id))?.position).toBe(5);
    expect((await readTask(f.other.id))?.position).toBe(2);
    expect(await requestCount()).toBe(0);
  });
});

describe("change requests on the viewer's task", () => {
  it("lets the viewer assignee accept a status request", async () => {
    const f = await seed();
    const requestId = await requestStatus(f.member, f.own.id, "in-review");
    const response = await answer(f.viewer, requestId, "accept");
    expect(response.status).toBe(200);
    expect((await readTask(f.own.id))?.status).toBe("in-review");
  });

  it("refuses a viewer answering a request on a task not assigned to them", async () => {
    const f = await seed();
    // The creator is involved in `other`; demote them to viewer.
    const requestId = await requestStatus(f.member, f.own.id, "in-review");
    const otherViewer = await addWorkspaceMember(f.workspace.id, "viewer");
    expect((await answer(otherViewer, requestId, "accept")).status).toBe(403);
    expect((await readTask(f.own.id))?.status).toBe("to-do");
  });

  it("refuses the viewer once the task was reassigned away before they answer", async () => {
    const f = await seed();
    const requestId = await requestStatus(f.member, f.own.id, "in-review");
    const third = await addWorkspaceMember(f.workspace.id);
    await db
      .update(schema.taskTable)
      .set({ userId: third.id })
      .where(eq(schema.taskTable.id, f.own.id));
    expect((await answer(f.viewer, requestId, "accept")).status).toBe(403);
    expect((await readTask(f.own.id))?.status).toBe("to-do");
  });
});

describe("other credentials and roles narrow the same way", () => {
  it("the viewer's API key works on their own task only", async () => {
    const f = await seed();
    const { key } = await createKey(f.viewer.id);
    const send = withKey(key);
    expect((await workCalls(send, f, f.own.id).status()).status).toBe(200);
    expect((await workCalls(send, f, f.other.id).status()).status).toBe(403);
    expect((await workCalls(send, f, f.other.id).comment()).status).toBe(403);
    expect(await requestCount()).toBe(0);
  });

  it("a member's key scoped to task:update_assigned refuses, never requests, on other tasks", async () => {
    const f = await seed("member");
    const { key } = await createKey(f.viewer.id, {
      task: ["read", "update_assigned"],
      workspace: ["read"],
    });
    const send = withKey(key);
    expect((await workCalls(send, f, f.own.id).status()).status).toBe(200);
    expect((await workCalls(send, f, f.other.id).status()).status).toBe(403);
    expect((await workCalls(send, f, f.other.id).title()).status).toBe(403);
    expect(await requestCount()).toBe(0);
    // Without the key the member still asks: a request.
    expect(
      (
        await as(f.viewer)(
          `/api/task/status/${f.other.id}`,
          json("PUT", { status: "in-review" }),
        )
      ).status,
    ).toBe(202);
  });

  it("a custom role with task:read and task:update_assigned behaves like the viewer", async () => {
    const f = await seed("worker");
    await db.insert(schema.workspaceRoleTable).values({
      workspaceId: f.workspace.id,
      role: "worker",
      permission: JSON.stringify({
        task: ["read", "update_assigned"],
        project: ["read"],
        label: ["read"],
        workspace: ["read"],
      }),
    });
    const send = as(f.viewer);
    expect((await workCalls(send, f, f.own.id).status()).status).toBe(200);
    expect((await workCalls(send, f, f.own.id).comment()).status).toBe(200);
    expect((await workCalls(send, f, f.other.id).status()).status).toBe(403);
    expect((await workCalls(send, f, f.other.id).comment()).status).toBe(403);
    expect(
      (
        await send(
          `/api/task/assignee/${f.other.id}`,
          json("PUT", { userId: f.viewer.id }),
        )
      ).status,
    ).toBe(403);
    expect(await requestCount()).toBe(0);
  });

  it("a member is unchanged: edits on another's task apply, status asks", async () => {
    const f = await seed("member");
    const calls = workCalls(as(f.viewer), f, f.other.id);
    expect((await calls.title()).status).toBe(200);
    expect((await calls.comment()).status).toBe(200);
    expect((await calls.status()).status).toBe(202);
  });
});

describe("what the viewer is told it can do", () => {
  it("capabilities report updateAssignedTasks without updateTasks", async () => {
    const f = await seed();
    const response = await as(f.viewer)(
      `/api/workspace/${f.workspace.id}/capabilities`,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      updateTasks: false,
      updateAssignedTasks: true,
      createTasks: false,
      deleteTasks: false,
      assignTasks: false,
    });
  });

  it("board and task reads say apply on the viewer's own task and deny elsewhere", async () => {
    const f = await seed();
    const send = as(f.viewer);
    const response = await send(`/api/board/workspace/${f.workspace.id}`);
    expect(response.status).toBe(200);
    const { tasks } = (await response.json()) as {
      tasks: { id: string; statusChange: { move: string } }[];
    };
    const move = new Map(tasks.map((t) => [t.id, t.statusChange.move]));
    expect(move.get(f.own.id)).toBe("apply");
    expect(move.get(f.other.id)).toBe("deny");

    for (const [task, expected] of [
      [f.own, "apply"],
      [f.other, "deny"],
    ] as const) {
      const read = await send(`/api/task/${task.id}`);
      expect(
        ((await read.json()) as { statusChange: { move: string } }).statusChange
          .move,
      ).toBe(expected);
    }
  });
});
