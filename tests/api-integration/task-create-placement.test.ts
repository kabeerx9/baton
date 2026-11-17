import { randomUUID } from "node:crypto";
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
import { ensureBoardProject } from "../../apps/api/src/board/controllers/ensure-board-project";
import * as events from "../../apps/api/src/events";
import { createApp } from "../../apps/api/src/index";
import createTask from "../../apps/api/src/task/controllers/create-task";
import { NEEDS_PARENT_MESSAGE } from "../../apps/api/src/task/task-placement";
import { as, createKey, withKey } from "./helpers/change-requests";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";
import { connectMcpAgent } from "./helpers/mcp-oauth";
import { addWorkspaceMember } from "./helpers/project-access/add-workspace-member";

type App = ReturnType<typeof createApp>["app"];
type Send = (path: string, init?: RequestInit) => Promise<Response> | Response;

const body = JSON.stringify({
  title: "Orphan",
  description: "",
  priority: "low",
  status: "to-do",
});

async function seed() {
  const { user, workspace } = await createWorkspaceMember({ role: "owner" });
  const board = await ensureBoardProject(workspace.id);
  const { project: repo } = await createProjectFixture({
    workspaceId: workspace.id,
    slug: "API",
  });
  return { user, workspace, board, repo };
}

async function counts(projectId: string) {
  const tasks = await db
    .select({ id: schema.taskTable.id })
    .from(schema.taskTable)
    .where(eq(schema.taskTable.projectId, projectId));
  const activity = await db
    .select({ id: schema.activityTable.id })
    .from(schema.activityTable)
    .innerJoin(
      schema.taskTable,
      eq(schema.taskTable.id, schema.activityTable.taskId),
    )
    .where(eq(schema.taskTable.projectId, projectId));
  const [project] = await db
    .select()
    .from(schema.projectTable)
    .where(eq(schema.projectTable.id, projectId));
  return { tasks: tasks.length, activity: activity.length, project };
}

async function expectRefused(send: Send, repoId: string) {
  const response = await send(`/api/task/${repoId}`, { method: "POST", body });
  expect(response.status).toBe(400);
  expect(((await response.json()) as { message: string }).message).toBe(
    NEEDS_PARENT_MESSAGE,
  );
}

async function signUp(app: App) {
  const response = await app.request("/api/auth/sign-up/email", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "http://localhost:5173",
    },
    body: JSON.stringify({
      name: "Agent owner",
      email: `${randomUUID()}@example.com`,
      password: "placement-test-password",
    }),
  });
  expect(response.status).toBe(200);
  return (await response.json()) as { token: string; user: { id: string } };
}

describe("API integration: a repo task sits under a feature", () => {
  beforeEach(resetTestDatabase);
  afterEach(() => vi.unstubAllGlobals());

  it("refuses a parentless create in a repo and leaves no trace", async () => {
    const { user, repo } = await seed();
    const before = await counts(repo.id);
    const publish = vi.spyOn(events, "publishEvent");

    await expectRefused(as(user), repo.id);

    const after = await counts(repo.id);
    expect(after.tasks).toBe(before.tasks);
    expect(after.activity).toBe(before.activity);
    // No task number was claimed.
    expect(after.project).toEqual(before.project);
    expect(publish).not.toHaveBeenCalled();
  });

  it("still creates a standalone task in the board project by id", async () => {
    const { user, board } = await seed();
    const publish = vi.spyOn(events, "publishEvent");
    const response = await as(user)(`/api/task/${board.id}`, {
      method: "POST",
      body,
    });
    expect(response.status).toBe(200);
    const task = (await response.json()) as {
      number: number;
      projectId: string;
    };
    expect(task.projectId).toBe(board.id);
    expect(board.slug).toBe("T");
    expect(task.number).toBe(1);
    // Positive control for the spy the refusal test relies on.
    expect(publish).toHaveBeenCalledWith("task.created", expect.anything());
  });

  it("creates a repo task under a feature, task and link together", async () => {
    const { user, workspace, repo } = await seed();
    const send = as(user);
    const feature = (await (
      await send(`/api/board/workspace/${workspace.id}`, {
        method: "POST",
        body: JSON.stringify({ title: "Feature" }),
      })
    ).json()) as { id: string };

    const response = await send(`/api/board/${feature.id}/subtask`, {
      method: "POST",
      body: JSON.stringify({ projectId: repo.id, title: "Repo work" }),
    });
    expect(response.status).toBe(200);
    const child = (await response.json()) as { id: string; projectId: string };
    expect(child.projectId).toBe(repo.id);
    const [link] = await db
      .select()
      .from(schema.taskRelationTable)
      .where(
        and(
          eq(schema.taskRelationTable.sourceTaskId, feature.id),
          eq(schema.taskRelationTable.targetTaskId, child.id),
        ),
      );
    expect(link?.relationType).toBe("subtask");
  });

  it("leaves no task and no used number when the subtask link fails", async () => {
    const { user, repo } = await seed();
    const before = await counts(repo.id);
    // The placement rule passes (a parent is named); the link insert then
    // fails its foreign key and rolls the task back.
    await expect(
      createTask({
        projectId: repo.id,
        currentUserId: user.id,
        title: "Repo work",
        status: "to-do",
        parentTaskId: "missing-feature",
      }),
    ).rejects.toThrow();
    const after = await counts(repo.id);
    expect(after.tasks).toBe(before.tasks);
    expect(after.project).toEqual(before.project);
  });

  it("gives the same 400 to a session, an API key and an MCP token", async () => {
    const { app } = createApp();
    const realFetch = globalThis.fetch;
    vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      if (url.pathname.startsWith("/api/"))
        return app.request(`${url.pathname}${url.search}`, init);
      return realFetch(input, init);
    });
    const person = await signUp(app);
    const { workspace } = await createWorkspaceMember();
    await db.insert(schema.workspaceUserTable).values({
      workspaceId: workspace.id,
      userId: person.user.id,
      role: "owner",
      joinedAt: new Date(),
    });
    const { project: repo } = await createProjectFixture({
      workspaceId: workspace.id,
      slug: "API",
    });

    await expectRefused(
      (path, init) =>
        app.request(path, {
          ...init,
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${person.token}`,
          },
        }),
      repo.id,
    );
    const agent = await connectMcpAgent(app, { bearer: person.token });
    await expectRefused(
      (path, init) =>
        app.request(path, {
          ...init,
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${agent.accessToken}`,
          },
        }),
      repo.id,
    );
    const key = await createKey(person.user.id);
    await expectRefused(withKey(key.key), repo.id);
  });

  it("answers a project in another workspace as before, never with the rule", async () => {
    const { repo } = await seed();
    const { user: stranger } = await createWorkspaceMember({ role: "owner" });
    const response = await as(stranger)(`/api/task/${repo.id}`, {
      method: "POST",
      body,
    });
    expect([403, 404]).toContain(response.status);
    expect(((await response.json()) as { message: string }).message).not.toBe(
      NEEDS_PARENT_MESSAGE,
    );
  });

  it("checks task:create before the rule", async () => {
    const { workspace, repo } = await seed();
    const viewer = await addWorkspaceMember(workspace.id, "viewer");
    const response = await as(viewer)(`/api/task/${repo.id}`, {
      method: "POST",
      body,
    });
    expect(response.status).toBe(403);
  });
});
