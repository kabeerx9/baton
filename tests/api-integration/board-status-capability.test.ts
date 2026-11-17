import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { ensureBoardProject } from "../../apps/api/src/board/controllers/ensure-board-project";
import { as, createKey, withKey } from "./helpers/change-requests";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";
import { addWorkspaceMember } from "./helpers/project-access/add-workspace-member";
import { restrictToProjects } from "./helpers/project-access/restrict-to-projects";

type Move = { move: "apply" | "request" | "deny" };
type Item = {
  id: string;
  statusGeneration: number;
  statusChange: Move;
  subtasks: Item[];
};
type Send = (path: string, init?: RequestInit) => Promise<Response> | Response;

/**
 * A plain task (creator + assignee), a feature with a hidden-repo task only,
 * a feature with a visible task, and an archived plain task.
 */
async function seed() {
  const { user: owner, workspace } = await createWorkspaceMember({
    role: "owner",
  });
  const creator = await addWorkspaceMember(workspace.id);
  const assignee = await addWorkspaceMember(workspace.id);
  const outsider = await addWorkspaceMember(workspace.id);
  const admin = await addWorkspaceMember(workspace.id, "admin");
  const board = await ensureBoardProject(workspace.id);
  const { project: api } = await createProjectFixture({
    workspaceId: workspace.id,
    slug: "API",
  });
  const { project: secret } = await createProjectFixture({
    workspaceId: workspace.id,
    slug: "SEC",
  });
  await restrictToProjects(workspace.id, outsider.id, [api.id, board.id]);

  const insert = async (
    projectId: string,
    number: number,
    extra: Partial<typeof schema.taskTable.$inferInsert> = {},
  ) => {
    const [task] = await db
      .insert(schema.taskTable)
      .values({ projectId, number, title: `Task ${number}`, ...extra })
      .returning();
    return task;
  };
  const plain = await insert(board.id, 1, {
    createdBy: creator.id,
    userId: assignee.id,
    statusGeneration: 3,
  });
  const hiddenFeature = await insert(board.id, 2, { createdBy: creator.id });
  const visibleFeature = await insert(board.id, 3, { createdBy: creator.id });
  const archived = await insert(board.id, 4, {
    createdBy: creator.id,
    status: "archived",
  });
  const secretChild = await insert(secret.id, 1, { createdBy: creator.id });
  const apiChild = await insert(api.id, 1, {
    createdBy: creator.id,
    userId: outsider.id,
  });
  // A task under a feature with no repo lives in the board project.
  const noRepoChild = await insert(board.id, 5, {
    createdBy: creator.id,
    userId: assignee.id,
  });
  for (const [parent, child] of [
    [hiddenFeature, secretChild],
    [visibleFeature, apiChild],
    [visibleFeature, noRepoChild],
  ] as const)
    await db.insert(schema.taskRelationTable).values({
      sourceTaskId: parent.id,
      targetTaskId: child.id,
      relationType: "subtask",
    });
  return {
    workspace,
    owner,
    creator,
    assignee,
    outsider,
    admin,
    plain,
    hiddenFeature,
    visibleFeature,
    archived,
    apiChild,
    noRepoChild,
  };
}

async function board(send: Send, workspaceId: string) {
  const response = await send(`/api/board/workspace/${workspaceId}`);
  expect(response.status).toBe(200);
  const body = (await response.json()) as { tasks: Item[] };
  const byId = new Map<string, Item>();
  for (const item of body.tasks) {
    byId.set(item.id, item);
    for (const sub of item.subtasks) byId.set(sub.id, sub);
  }
  return byId;
}

async function readTask(send: Send, taskId: string) {
  const response = await send(`/api/task/${taskId}`);
  expect(response.status).toBe(200);
  return (await response.json()) as Record<string, unknown> & {
    statusGeneration: number;
    statusChange: Move;
  };
}

describe("API integration: statusChange and statusGeneration on reads", () => {
  beforeEach(resetTestDatabase);

  it("says apply for the creator, the assignee and an admin, request for an outsider", async () => {
    const f = await seed();
    for (const [user, move] of [
      [f.creator, "apply"],
      [f.assignee, "apply"],
      [f.admin, "apply"],
      [f.owner, "apply"],
      [f.outsider, "request"],
    ] as const) {
      const items = await board(as(user), f.workspace.id);
      expect(items.get(f.plain.id)?.statusChange).toEqual({ move });
      expect((await readTask(as(user), f.plain.id)).statusChange).toEqual({
        move,
      });
    }
  });

  it("says apply on a feature for an outsider, even when its only task is hidden", async () => {
    const f = await seed();
    const items = await board(as(f.outsider), f.workspace.id);
    // The outsider sees no task under it, but the write counts it.
    expect(items.get(f.hiddenFeature.id)?.subtasks).toEqual([]);
    expect(items.get(f.hiddenFeature.id)?.statusChange).toEqual({
      move: "apply",
    });
    expect(items.get(f.visibleFeature.id)?.statusChange).toEqual({
      move: "apply",
    });
    // A subtask follows its own involvement: the outsider owns this one.
    expect(items.get(f.apiChild.id)?.statusChange).toEqual({ move: "apply" });
    expect(
      (await board(as(f.assignee), f.workspace.id)).get(f.apiChild.id)
        ?.statusChange,
    ).toEqual({ move: "request" });
  });

  it("judges a no-repo subtask by its own involvement, not as a feature", async () => {
    const f = await seed();
    for (const [user, move] of [
      [f.creator, "apply"],
      [f.assignee, "apply"],
      [f.admin, "apply"],
      [f.outsider, "request"],
    ] as const) {
      const items = await board(as(user), f.workspace.id);
      expect(items.get(f.noRepoChild.id)?.statusChange).toEqual({ move });
    }
  });

  it("refuses the item read to an API key without task:read", async () => {
    const f = await seed();
    const key = await createKey(f.creator.id, { task: ["update"] });
    const response = await withKey(key.key)(
      `/api/board/workspace/${f.workspace.id}/item/T-1`,
    );
    expect(response.status).toBe(403);
  });

  it("treats leaving archived as archive, so an outsider must ask", async () => {
    const f = await seed();
    const items = await board(as(f.outsider), f.workspace.id);
    expect(items.get(f.archived.id)?.statusChange).toEqual({
      move: "request",
    });
  });

  it("matches what the status write then does", async () => {
    const f = await seed();
    const asked = await as(f.outsider)(`/api/task/status/${f.plain.id}`, {
      method: "PUT",
      body: JSON.stringify({ status: "in-progress" }),
    });
    expect(asked.status).toBe(202);
    const applied = await as(f.assignee)(`/api/task/status/${f.plain.id}`, {
      method: "PUT",
      body: JSON.stringify({ status: "in-progress" }),
    });
    expect(applied.status).toBe(200);
    const body = (await applied.json()) as {
      task: { statusGeneration: number };
    };
    expect(body.task.statusGeneration).toBe(4);
  });

  it("says deny for an API key whose scope lacks task:update, on every read", async () => {
    const f = await seed();
    const readOnly = await createKey(f.creator.id, { task: ["read"] });
    const send = withKey(readOnly.key);
    const items = await board(send, f.workspace.id);
    expect(items.get(f.plain.id)?.statusChange).toEqual({ move: "deny" });
    expect(items.get(f.visibleFeature.id)?.statusChange).toEqual({
      move: "deny",
    });
    expect((await readTask(send, f.plain.id)).statusChange).toEqual({
      move: "deny",
    });
    const full = await createKey(f.creator.id);
    expect(
      (await board(withKey(full.key), f.workspace.id)).get(f.plain.id)
        ?.statusChange,
    ).toEqual({ move: "apply" });
  });

  it("returns statusGeneration on the board, the item read and both task reads", async () => {
    const f = await seed();
    const send = as(f.owner);
    expect((await board(send, f.workspace.id)).get(f.plain.id)).toMatchObject({
      statusGeneration: 3,
    });
    const item = (await (
      await send(`/api/board/workspace/${f.workspace.id}/item/T-1`)
    ).json()) as { task: Item };
    expect(item.task).toMatchObject({
      statusGeneration: 3,
      statusChange: { move: "apply" },
    });
    const task = await readTask(send, f.plain.id);
    expect(task.statusGeneration).toBe(3);
    expect(task).not.toHaveProperty("createdBy");
    const byKey = await send(
      `/api/task/by-ticket-id/T-1?workspaceId=${f.workspace.id}`,
    );
    expect(byKey.status).toBe(200);
    expect(await byKey.json()).toMatchObject({
      statusGeneration: 3,
      statusChange: { move: "apply" },
    });
  });

  it("does not send the creator on board items", async () => {
    const f = await seed();
    const response = await as(f.owner)(
      `/api/board/workspace/${f.workspace.id}`,
    );
    expect(await response.text()).not.toContain("createdBy");
  });
});
