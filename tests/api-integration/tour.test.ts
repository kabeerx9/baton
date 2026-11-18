import { randomUUID } from "node:crypto";
import { eq, inArray, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { workspaceJoinLinkTable } from "../../apps/api/src/database/schema";
import { hashJoinToken } from "../../apps/api/src/join-link/token";
import { createApp } from "../../apps/api/src/index";
import { deleteAccountData } from "../../apps/api/src/user/controllers/delete-account-data";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import { createWorkspaceMember } from "./helpers/fixtures";
import { createInstanceAdmin } from "./helpers/admin/create-instance-admin";

type TourStart = {
  demoWorkspace: { id: string; slug: string; projectId: string };
  tasks: { key: string; id: string; number?: number }[];
};
type BoardItem = {
  id: string;
  key: string;
  column: string;
  waitsOn: { id: string }[];
};

beforeEach(resetTestDatabase);

function call(path: string, init?: RequestInit) {
  return createApp().app.request(`/api${path}`, init);
}
const post = (path: string, body?: unknown) =>
  call(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

async function start() {
  const response = await post("/tour/start");
  expect(response.status).toBe(200);
  return (await response.json()) as TourStart;
}

async function demoWorkspacesOf(userId: string) {
  return db
    .select({ id: schema.workspaceTable.id })
    .from(schema.workspaceTable)
    .where(eq(schema.workspaceTable.demoOwnerUserId, userId));
}

async function count(table: string, column: string, ids: string[]) {
  const result = await db.execute(
    sql`select count(*)::int as n from ${sql.identifier(table)} where ${sql.identifier(column)} in ${
      ids.length
        ? sql`(${sql.join(
            ids.map((id) => sql`${id}`),
            sql`, `,
          )})`
        : sql`('')`
    }`,
  );
  return (result.rows[0] as { n: number }).n;
}

describe("tour routes", () => {
  it("seeds five tasks with their waits-on links on a board that renders", async () => {
    const { user } = await createWorkspaceMember({ role: "owner" });
    mockAuthenticatedSession(user);

    const seeded = await start();
    expect(seeded.tasks.map((task) => task.key)).toEqual([
      "design-review",
      "api-endpoint",
      "write-tests",
      "ship-release",
      "mcp-hello",
    ]);

    const board = await call(`/board/workspace/${seeded.demoWorkspace.id}`);
    expect(board.status).toBe(200);
    const items = ((await board.json()) as { tasks: BoardItem[] }).tasks;
    expect(items).toHaveLength(5);
    const byKey = new Map(seeded.tasks.map((task) => [task.key, task.id]));
    const item = (key: string) => items.find((i) => i.id === byKey.get(key))!;
    expect(new Set(items.map((i) => i.column))).toEqual(
      new Set(["todo", "doing", "review", "done"]),
    );
    expect(item("write-tests").waitsOn.map((w) => w.id)).toEqual([
      byKey.get("api-endpoint"),
    ]);
    expect(item("ship-release").waitsOn.map((w) => w.id)).toEqual([
      byKey.get("write-tests"),
    ]);
    expect(item("api-endpoint").waitsOn).toEqual([]);

    const assignees = await db
      .select({ userId: schema.taskTable.userId })
      .from(schema.taskTable)
      .where(inArray(schema.taskTable.id, [...byKey.values()]));
    expect(assignees.every((row) => row.userId === user.id)).toBe(true);

    const state = await call("/tour");
    expect(await state.json()).toEqual({
      completed: false,
      demoWorkspace: {
        id: seeded.demoWorkspace.id,
        slug: seeded.demoWorkspace.slug,
      },
    });
  });

  it("resumes the same demo on a second start, even after the user edits it", async () => {
    const { user } = await createWorkspaceMember();
    mockAuthenticatedSession(user);
    const first = await start();
    // The user renames and moves a task during the tour; a reload follows.
    const apiTask = first.tasks.find((task) => task.key === "api-endpoint")!;
    await db
      .update(schema.taskTable)
      .set({ title: "Renamed during the tour", status: "done" })
      .where(eq(schema.taskTable.id, apiTask.id));
    const second = await start();

    expect(second).toEqual(first);
    expect(await demoWorkspacesOf(user.id)).toEqual([
      { id: first.demoWorkspace.id },
    ]);
    const [kept] = await db
      .select({ status: schema.taskTable.status })
      .from(schema.taskTable)
      .where(eq(schema.taskTable.id, apiTask.id));
    expect(kept?.status).toBe("done");
  });

  it("replaces a demo that lost a tour task", async () => {
    const { user } = await createWorkspaceMember();
    mockAuthenticatedSession(user);
    const first = await start();
    await db
      .delete(schema.taskTable)
      .where(eq(schema.taskTable.id, first.tasks[0]!.id));
    const second = await start();

    expect(second.demoWorkspace.id).not.toBe(first.demoWorkspace.id);
    expect(second.tasks).toHaveLength(5);
    expect(await demoWorkspacesOf(user.id)).toEqual([
      { id: second.demoWorkspace.id },
    ]);
    expect(
      await count(
        "task",
        "id",
        first.tasks.map((task) => task.id),
      ),
    ).toBe(0);
  });

  it("ends parallel starts with exactly one demo workspace", async () => {
    const { user } = await createWorkspaceMember();
    mockAuthenticatedSession(user);

    const responses = await Promise.all(
      Array.from({ length: 4 }, () => post("/tour/start")),
    );
    expect(responses.map((response) => response.status)).toEqual([
      200, 200, 200, 200,
    ]);
    const bodies = (await Promise.all(
      responses.map((response) => response.json()),
    )) as TourStart[];
    // Every start returns the one demo: the later ones resume it.
    expect(new Set(bodies.map((body) => body.demoWorkspace.id)).size).toBe(1);
    expect(await demoWorkspacesOf(user.id)).toHaveLength(1);
    const tasks = await db.execute(
      sql`select count(*)::int as n from task t join project p on p.id = t.project_id join workspace w on w.id = p.workspace_id where w.demo_owner_user_id = ${user.id}`,
    );
    expect((tasks.rows[0] as { n: number }).n).toBe(5);
  });

  it("refuses a second demo workspace for one user in the database", async () => {
    const { user } = await createWorkspaceMember();
    const insert = () =>
      db.insert(schema.workspaceTable).values({
        name: "Baton tour",
        slug: `tour-${randomUUID()}`,
        createdAt: new Date(),
        kind: "demo",
        demoOwnerUserId: user.id,
      });
    await insert();
    await expect(insert()).rejects.toThrow();
    // A demo always names its owner, and a team workspace never does.
    await expect(
      db.insert(schema.workspaceTable).values({
        name: "No owner",
        slug: `tour-${randomUUID()}`,
        createdAt: new Date(),
        kind: "demo",
      }),
    ).rejects.toThrow();
    await expect(
      db.insert(schema.workspaceTable).values({
        name: "Odd",
        slug: `odd-${randomUUID()}`,
        createdAt: new Date(),
        kind: "other",
      }),
    ).rejects.toThrow();
  });

  it("finish deletes every demo row, is idempotent, and start then refuses with 409", async () => {
    const { user } = await createWorkspaceMember();
    mockAuthenticatedSession(user);
    const seeded = await start();
    const workspaceId = seeded.demoWorkspace.id;
    const taskIds = seeded.tasks.map((task) => task.id);

    // Real activity on the demo: a status change, a comment, a notification
    // and an outbox row, so the cascade has something to remove.
    const moved = await call(`/task/status/${taskIds[1]}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "done" }),
    });
    expect(moved.status).toBe(200);
    await db.insert(schema.commentTable).values({
      taskId: taskIds[0]!,
      userId: user.id,
      content: "Looks good",
    });
    await db.insert(schema.notificationTable).values([
      {
        userId: user.id,
        type: "info",
        resourceType: "task",
        resourceId: taskIds[0],
      },
      {
        userId: user.id,
        type: "info",
        resourceType: "workspace",
        resourceId: workspaceId,
      },
    ]);
    await db.insert(schema.outboxTable).values({
      workspaceId,
      type: "task.status_changed",
      consumer: "activity",
      payload: { v: 1 },
    });
    await db.insert(schema.taskChangeRequestTable).values({
      workspaceId,
      taskId: taskIds[0]!,
      projectId: seeded.demoWorkspace.projectId,
      kind: "status",
      targetStatus: "done",
      requestedBy: user.id,
      taskKey: "T-1",
      taskTitle: "Review the checkout design",
      baseStatus: "in-review",
      baseGeneration: 0,
      expiresAt: new Date(Date.now() + 60_000),
    } as typeof schema.taskChangeRequestTable.$inferInsert);

    const finished = await post("/tour/finish", { outcome: "skipped" });
    expect(finished.status).toBe(200);
    expect(await finished.json()).toEqual({ completed: true });

    expect(await demoWorkspacesOf(user.id)).toEqual([]);
    expect(await count("task", "id", taskIds)).toBe(0);
    expect(await count("project", "workspace_id", [workspaceId])).toBe(0);
    expect(await count("workspace_member", "workspace_id", [workspaceId])).toBe(
      0,
    );
    expect(await count("workspace_role", "workspace_id", [workspaceId])).toBe(
      0,
    );
    expect(await count("task_relation", "source_task_id", taskIds)).toBe(0);
    expect(await count("activity", "task_id", taskIds)).toBe(0);
    expect(await count("comment", "task_id", taskIds)).toBe(0);
    expect(
      await count("notification", "resource_id", [...taskIds, workspaceId]),
    ).toBe(0);
    expect(await count("outbox", "workspace_id", [workspaceId])).toBe(0);
    expect(
      await count("task_change_request", "workspace_id", [workspaceId]),
    ).toBe(0);

    const [{ tourCompletedAt: firstTime }] = await db
      .select({ tourCompletedAt: schema.userTable.tourCompletedAt })
      .from(schema.userTable)
      .where(eq(schema.userTable.id, user.id));
    expect(firstTime).toBeInstanceOf(Date);

    const again = await post("/tour/finish", { outcome: "finished" });
    expect(again.status).toBe(200);
    const [{ tourCompletedAt: secondTime }] = await db
      .select({ tourCompletedAt: schema.userTable.tourCompletedAt })
      .from(schema.userTable)
      .where(eq(schema.userTable.id, user.id));
    expect(secondTime).toEqual(firstTime);

    expect((await post("/tour/start")).status).toBe(409);
    expect(await demoWorkspacesOf(user.id)).toEqual([]);
    expect(await (await call("/tour")).json()).toEqual({
      completed: true,
      demoWorkspace: null,
    });
  });

  it("validates the finish outcome", async () => {
    const { user } = await createWorkspaceMember();
    mockAuthenticatedSession(user);
    expect((await post("/tour/finish", { outcome: "maybe" })).status).toBe(400);
  });

  it("replay clears completion so start works again", async () => {
    const { user } = await createWorkspaceMember();
    mockAuthenticatedSession(user);
    await post("/tour/finish", { outcome: "finished" });
    expect((await post("/tour/start")).status).toBe(409);

    const replay = await post("/tour/replay");
    expect(replay.status).toBe(200);
    expect(await replay.json()).toEqual({ completed: false });
    await start();
    expect(await demoWorkspacesOf(user.id)).toHaveLength(1);
  });

  it("replay deletes a running demo, so the next start is a fresh tour", async () => {
    const { user } = await createWorkspaceMember();
    mockAuthenticatedSession(user);
    const first = await start();
    expect((await post("/tour/replay")).status).toBe(200);
    expect(await demoWorkspacesOf(user.id)).toEqual([]);
    const second = await start();
    expect(second.demoWorkspace.id).not.toBe(first.demoWorkspace.id);
  });
});

describe("demo workspace visibility", () => {
  it("is absent from workspace lists, MCP lists and search, but readable by its owner", async () => {
    const { user, workspace } = await createWorkspaceMember({ role: "owner" });
    mockAuthenticatedSession(user);
    const seeded = await start();
    const demoId = seeded.demoWorkspace.id;

    // GET /api/workspace is also what the MCP list_workspaces tool calls.
    const list = (await (await call("/workspace")).json()) as {
      id: string;
      kind: string;
    }[];
    expect(list.map((w) => w.id)).toEqual([workspace.id]);
    expect(list[0]?.kind).toBe("team");

    const direct = await call(`/workspace/${demoId}`);
    expect(direct.status).toBe(200);
    expect(await direct.json()).toMatchObject({ id: demoId, kind: "demo" });

    const search = await call(
      `/search?q=payments&type=all&workspaceId=${workspace.id}`,
    );
    expect(search.status).toBe(200);
    expect(JSON.stringify(await search.json())).not.toContain(demoId);
    const named = await call(`/search?q=payments&workspaceId=${demoId}`);
    expect(((await named.json()) as { results: unknown[] }).results).toEqual(
      [],
    );
  });

  it("is absent from the admin list and counts, and refuses admins who are not members", async () => {
    const { user } = await createWorkspaceMember();
    mockAuthenticatedSession(user);
    const seeded = await start();
    const demoId = seeded.demoWorkspace.id;

    const admin = await createInstanceAdmin();
    mockAuthenticatedSession(admin);
    const adminList = await call("/admin/workspaces");
    expect(adminList.status).toBe(200);
    const body = (await adminList.json()) as {
      workspaces: { id: string }[];
      total: number;
    };
    expect(body.workspaces.map((w) => w.id)).not.toContain(demoId);
    expect(body.total).toBe(1);
    const overview = (await (await call("/admin/overview")).json()) as {
      workspaces: { total: number };
    };
    expect(overview.workspaces.total).toBe(1);

    expect((await call(`/workspace/${demoId}`)).status).toBe(404);
    expect((await call(`/board/workspace/${demoId}`)).status).toBe(404);
    expect((await call(`/task/${seeded.tasks[0]!.id}`)).status).toBe(404);
    const addMember = await post(`/admin/workspaces/${demoId}/members`, {
      userId: admin.id,
      role: "member",
    });
    expect(addMember.status).toBe(404);
  });

  it("refuses another user on every read path", async () => {
    const { user } = await createWorkspaceMember();
    mockAuthenticatedSession(user);
    const seeded = await start();
    const demoId = seeded.demoWorkspace.id;

    const { user: other } = await createWorkspaceMember();
    mockAuthenticatedSession(other);
    expect((await call(`/workspace/${demoId}`)).status).toBe(404);
    expect((await call(`/board/workspace/${demoId}`)).status).toBe(404);
    expect((await call(`/task/${seeded.tasks[0]!.id}`)).status).toBe(404);
    expect(await (await call("/tour")).json()).toEqual({
      completed: false,
      demoWorkspace: null,
    });
    // Another user's finish never touches this demo.
    await post("/tour/finish", { outcome: "skipped" });
    expect(await demoWorkspacesOf(user.id)).toHaveLength(1);
  });
});

describe("account deletion", () => {
  it("deletes the user's demo workspace with the account", async () => {
    const { user } = await createWorkspaceMember({ role: "owner" });
    mockAuthenticatedSession(user);
    const seeded = await start();

    await deleteAccountData(user.id);
    await db.delete(schema.userTable).where(eq(schema.userTable.id, user.id));
    expect(await count("workspace", "id", [seeded.demoWorkspace.id])).toBe(0);
  });
});

describe("sharing a demo workspace", () => {
  const origin = "http://localhost:5173";
  function authPost(path: string, body: unknown, cookie = "") {
    return createApp().app.request(`/api/auth${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: origin,
        Cookie: cookie,
      },
      body: JSON.stringify(body),
    });
  }
  async function signUp(email: string) {
    const response = await authPost("/sign-up/email", {
      name: email,
      email,
      password: "a-long-password",
    });
    expect(response.status).toBe(200);
    const cookie = response.headers
      .getSetCookie()
      .map((value) => value.split(";")[0])
      .join("; ");
    const { user } = (await response.json()) as { user: { id: string } };
    return { cookie, userId: user.id };
  }
  function tourStart(cookie: string) {
    return createApp().app.request("/api/tour/start", {
      method: "POST",
      headers: { Origin: origin, Cookie: cookie },
    });
  }

  it("refuses join links, new members and role changes", async () => {
    const owner = await signUp("owner@example.com");
    const started = await tourStart(owner.cookie);
    expect(started.status).toBe(200);
    const { demoWorkspace } = (await started.json()) as TourStart;

    const link = await createApp().app.request(
      `/api/join-link/workspace/${demoWorkspace.id}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: origin,
          Cookie: owner.cookie,
        },
        body: JSON.stringify({}),
      },
    );
    expect(link.status).toBe(403);
    expect(await link.json()).toMatchObject({ code: "DEMO_WORKSPACE" });
    expect(await db.select().from(workspaceJoinLinkTable)).toEqual([]);

    const friend = await signUp("friend@example.com");
    // A link written behind the API's back still cannot admit anyone.
    const token = "d".repeat(43);
    await db.insert(workspaceJoinLinkTable).values({
      workspaceId: demoWorkspace.id,
      tokenHash: hashJoinToken(token),
      expiresAt: new Date(Date.now() + 86_400_000),
    });
    const joined = await createApp().app.request("/api/join-link/join", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: origin,
        Cookie: friend.cookie,
      },
      body: JSON.stringify({ token }),
    });
    expect(joined.status).toBe(404);
    expect(await joined.json()).toMatchObject({ code: "JOIN_LINK_NOT_FOUND" });

    // A member written behind the API's back cannot be given a role.
    const [member] = await db
      .insert(schema.workspaceUserTable)
      .values({
        workspaceId: demoWorkspace.id,
        userId: friend.userId,
        role: "member",
        joinedAt: new Date(),
      })
      .returning();
    const role = await createApp().app.request(
      `/api/workspace/${demoWorkspace.id}/members/${member!.userId}/role`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Origin: origin,
          Cookie: owner.cookie,
        },
        body: JSON.stringify({ role: "admin" }),
      },
    );
    expect(role.status).toBe(403);
    expect(await role.json()).toMatchObject({ code: "DEMO_WORKSPACE" });
  });

  it("keeps the workspace list free of the demo and creates team workspaces", async () => {
    const owner = await signUp("lister@example.com");
    const create = (body: unknown) =>
      createApp().app.request("/api/workspace", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: origin,
          Cookie: owner.cookie,
        },
        body: JSON.stringify(body),
      });
    const created = await create({ name: "Real team", kind: "demo" });
    // kind is not an input: either refused or ignored, never stored.
    let slug: string;
    if (created.status === 201) {
      const workspace = (await created.json()) as { id: string; slug: string };
      slug = workspace.slug;
      const [row] = await db
        .select({ kind: schema.workspaceTable.kind })
        .from(schema.workspaceTable)
        .where(eq(schema.workspaceTable.id, workspace.id));
      expect(row?.kind).toBe("team");
    } else {
      expect(created.status).toBe(400);
      const retry = await create({ name: "Real team" });
      expect(retry.status).toBe(201);
      slug = ((await retry.json()) as { slug: string }).slug;
    }
    expect((await tourStart(owner.cookie)).status).toBe(200);

    const listed = await createApp().app.request("/api/workspace", {
      headers: { Origin: origin, Cookie: owner.cookie },
    });
    expect(listed.status).toBe(200);
    const workspaces = (await listed.json()) as {
      slug: string;
      kind?: string;
    }[];
    expect(workspaces.map((w) => w.slug)).toEqual([slug]);
    expect(workspaces[0]?.kind).toBe("team");
  });
});
