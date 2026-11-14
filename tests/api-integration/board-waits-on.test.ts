import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { ensureBoardProject } from "../../apps/api/src/board/controllers/ensure-board-project";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";
import { addWorkspaceMember } from "./helpers/project-access/add-workspace-member";
import { restrictToProjects } from "./helpers/project-access/restrict-to-projects";

type Linked = {
  id: string;
  key: string;
  title: string;
  assigneeName: string | null;
};
type Item = {
  id: string;
  key: string;
  column?: string;
  dueDate: string | null;
  finishedAt: string | null;
  waitsOn: Linked[];
  hiddenBlockers: number;
  blockedBy?: string[];
  subtasks?: Item[];
};
type AssignedTask = {
  id: string;
  waiting: Linked[];
  waitsOn: Linked[];
  hiddenBlockers: number;
};

const FINISHED = new Date("2030-03-04T05:06:07.000Z");
const EDITED = new Date("2030-06-07T08:09:10.000Z");
const DUE = new Date("2030-05-01T00:00:00.000Z");

/**
 * One workspace seen by a member who may read the Alpha repo and the board,
 * but not the Beta repo.
 */
async function seed({ boardAccess = true } = {}) {
  const { user: owner, workspace } = await createWorkspaceMember({
    role: "owner",
  });
  const board = await ensureBoardProject(workspace.id);
  const alpha = await createProjectFixture({
    workspaceId: workspace.id,
    slug: "alpha",
  });
  const beta = await createProjectFixture({
    workspaceId: workspace.id,
    slug: "beta",
  });
  const gone = await createProjectFixture({
    workspaceId: workspace.id,
    slug: "gone",
  });
  await db
    .update(schema.projectTable)
    .set({ archivedAt: new Date() })
    .where(eq(schema.projectTable.id, gone.project.id));
  const member = await addWorkspaceMember(workspace.id);
  await restrictToProjects(
    workspace.id,
    member.id,
    boardAccess ? [alpha.project.id, board.id] : [alpha.project.id],
  );

  const insert = async (
    projectId: string,
    number: number,
    title: string,
    status = "to-do",
    extra: Partial<typeof schema.taskTable.$inferInsert> = {},
  ) => {
    const [task] = await db
      .insert(schema.taskTable)
      .values({ projectId, number, title, status, ...extra })
      .returning();
    return task;
  };
  const link = async (
    relationType: "subtask" | "blocks",
    source: { id: string },
    target: { id: string },
  ) => {
    await db.insert(schema.taskRelationTable).values({
      sourceTaskId: source.id,
      targetTaskId: target.id,
      relationType,
    });
  };

  // Features. F1 stores "done" but has open tasks, so it is still open.
  const f1 = await insert(board.id, 1, "Live scoring", "done");
  const f2 = await insert(board.id, 2, "Draft room");
  const f3 = await insert(board.id, 3, "Finished feature");
  const f4 = await insert(board.id, 4, "Feature in review");
  // Plain top-level tasks.
  const t5 = await insert(board.id, 5, "Waits on another feature", "to-do", {
    dueDate: DUE,
  });
  const t6 = await insert(board.id, 6, "Waits on an open feature");
  const t7 = await insert(board.id, 7, "Waits on a finished feature");
  const t8 = await insert(board.id, 8, "Plain review", "in-review");
  // No status change logged, so its finish time falls back to updatedAt.
  const t9 = await insert(board.id, 9, "Plain done", "done", {
    updatedAt: EDITED,
  });

  const a1 = await insert(
    alpha.project.id,
    1,
    "Mine, hidden blocker",
    "to-do",
    {
      userId: member.id,
    },
  );
  const a2 = await insert(alpha.project.id, 2, "Done alpha", "done");
  const a3 = await insert(alpha.project.id, 3, "Alpha in other feature");
  const a4 = await insert(
    alpha.project.id,
    4,
    "Last of finished feature",
    "done",
  );
  const a5 = await insert(alpha.project.id, 5, "Review alpha", "in-review");
  const a6 = await insert(
    alpha.project.id,
    6,
    "Done in review feature",
    "done",
  );
  const a7 = await insert(alpha.project.id, 7, "Mine, blocks others", "to-do", {
    userId: member.id,
  });
  const archivedTask = await insert(
    alpha.project.id,
    8,
    "Archived alpha",
    "archived",
  );
  const b1 = await insert(beta.project.id, 1, "Hidden beta blocker");
  const b2 = await insert(beta.project.id, 2, "Hidden beta waiter");
  const g1 = await insert(gone.project.id, 1, "In an archived repo");

  await link("subtask", f1, a1);
  await link("subtask", f1, b1);
  await link("subtask", f2, a3);
  await link("subtask", f2, a7);
  await link("subtask", f3, a4);
  await link("subtask", f3, a2);
  await link("subtask", f4, a5);
  await link("subtask", f4, a6);

  await link("blocks", a3, t5); // subtask in another feature blocks a top-level task
  await link("blocks", archivedTask, t5); // archived: never blocks
  await link("blocks", g1, t5); // archived repo: never blocks
  await link("blocks", b1, a1); // hidden repo
  await link("blocks", a2, a3); // done: map edge only
  await link("blocks", a7, a3);
  await link("blocks", a7, b2); // the member must not learn about b2
  await link("blocks", f1, t6); // feature with open tasks
  await link("blocks", f3, t7); // feature whose tasks are all done

  await db.insert(schema.activityTable).values({
    taskId: a4.id,
    type: "status_changed",
    createdAt: FINISHED,
    eventData: { oldStatus: "to-do", newStatus: "done" },
  });

  return {
    owner,
    member,
    workspace,
    board,
    tasks: { f1, f2, f3, f4, t5, t6, t7, t8, t9, a1, a2, a3, a4, a7, b1 },
  };
}

function flatten(items: Item[]) {
  const byId = new Map<string, Item>();
  for (const item of items) {
    byId.set(item.id, item);
    for (const sub of item.subtasks ?? []) byId.set(sub.id, sub);
  }
  return byId;
}

describe("API integration: what a task waits on", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("returns waitsOn, hiddenBlockers, dueDate, finishedAt and the review column on the board", async () => {
    const { member, workspace, tasks } = await seed();
    mockAuthenticatedSession(member);
    const { app } = createApp();

    const response = await app.request(`/api/board/workspace/${workspace.id}`);
    expect(response.status).toBe(200);
    const body = (await response.json()) as { tasks: Item[] };
    const byId = flatten(body.tasks);
    const item = (task: { id: string }) => byId.get(task.id)!;

    // A1: a subtask in another feature blocks a top-level task. Archived
    // blockers and blockers in archived repos do not count.
    expect(item(tasks.t5)).toMatchObject({
      waitsOn: [
        {
          id: tasks.a3.id,
          key: "alpha-3",
          title: "Alpha in other feature",
          assigneeName: null,
        },
      ],
      hiddenBlockers: 0,
      dueDate: DUE.toISOString(),
      finishedAt: null,
    });

    // A2: a blocker in a hidden repo is only a count.
    expect(item(tasks.a1)).toMatchObject({ waitsOn: [], hiddenBlockers: 1 });
    const raw = JSON.stringify(body);
    expect(raw).not.toContain("Hidden beta");
    expect(raw).not.toContain(tasks.b1.id);

    // A3: a done blocker does not block but keeps its map edge.
    expect(item(tasks.a3).waitsOn.map((t) => t.id)).toEqual([tasks.a7.id]);
    expect(item(tasks.a3).blockedBy).toEqual(
      expect.arrayContaining([tasks.a2.id, tasks.a7.id]),
    );
    // A feature blocks while one of its tasks is open, whatever its own status.
    expect(item(tasks.t6).waitsOn.map((t) => t.id)).toEqual([tasks.f1.id]);
    expect(item(tasks.t7)).toMatchObject({ waitsOn: [], hiddenBlockers: 0 });

    // Review column and finished-at.
    expect(item(tasks.t8).column).toBe("review");
    expect(item(tasks.f4).column).toBe("review");
    expect(item(tasks.f2).column).toBe("todo");
    expect(item(tasks.f3)).toMatchObject({
      column: "done",
      finishedAt: FINISHED.toISOString(),
    });
    expect(item(tasks.a4).finishedAt).toBe(FINISHED.toISOString());
    expect(item(tasks.t9).finishedAt).toBe(EDITED.toISOString());
    expect(item(tasks.a1).finishedAt).toBeNull();
    expect(item(tasks.f1)).toMatchObject({ column: "todo", finishedAt: null });
  });

  it("gives team history the same finish time as the board", async () => {
    const { owner, workspace, tasks } = await seed();
    await db
      .update(schema.taskTable)
      .set({ userId: owner.id })
      .where(eq(schema.taskTable.id, tasks.a4.id));
    mockAuthenticatedSession(owner);
    const { app } = createApp();

    const history = await app.request(
      `/api/board/workspace/${workspace.id}/history?days=30`,
    );
    expect(history.status).toBe(200);
    const body = (await history.json()) as {
      people: Array<{ recent: Array<{ id: string; finishedAt: string }> }>;
    };
    const recent = body.people.flatMap((p) => p.recent);
    expect(recent.find((r) => r.id === tasks.a4.id)?.finishedAt).toBe(
      FINISHED.toISOString(),
    );
  });

  it("gives the owner the hidden blocker's key", async () => {
    const { owner, workspace, tasks } = await seed();
    mockAuthenticatedSession(owner);
    const { app } = createApp();

    const response = await app.request(`/api/board/workspace/${workspace.id}`);
    const byId = flatten(((await response.json()) as { tasks: Item[] }).tasks);
    expect(byId.get(tasks.a1.id)).toMatchObject({
      waitsOn: [{ id: tasks.b1.id, key: "beta-1" }],
      hiddenBlockers: 0,
    });
  });

  it("filters assigned tasks' waitsOn and waiting by repo access", async () => {
    const { member, workspace, tasks } = await seed();
    mockAuthenticatedSession(member);
    const { app } = createApp();

    const response = await app.request(
      `/api/task/assigned?workspaceId=${workspace.id}`,
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { tasks: AssignedTask[] };
    const mine = new Map(body.tasks.map((t) => [t.id, t]));

    expect(mine.get(tasks.a1.id)).toMatchObject({
      waitsOn: [],
      hiddenBlockers: 1,
      waiting: [],
    });
    // a7 blocks a3 (visible) and b2 (hidden repo): only a3 is listed.
    expect(mine.get(tasks.a7.id)).toMatchObject({
      waitsOn: [],
      hiddenBlockers: 0,
      waiting: [{ id: tasks.a3.id, key: "alpha-3" }],
    });
    expect(JSON.stringify(body)).not.toContain("Hidden beta");
  });

  it("names a hidden blocker only as a count when refusing done", async () => {
    const { member, owner, tasks } = await seed();
    const done = (id: string) =>
      createApp().app.request(`/api/task/status/${id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "done" }),
      });

    mockAuthenticatedSession(member);
    const refused = await done(tasks.a1.id);
    expect(refused.status).toBe(409);
    const message = await refused.text();
    expect(message).toContain("1 task you cannot see");
    expect(message).not.toContain("beta");

    // The general update path gives the same refusal.
    const updated = await createApp().app.request(`/api/task/${tasks.a1.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: tasks.a1.title,
        status: "done",
        priority: "no-priority",
        projectId: tasks.a1.projectId,
        position: 0,
        userId: member.id,
      }),
    });
    expect(updated.status).toBe(409);
    const updateMessage = await updated.text();
    expect(updateMessage).toContain("1 task you cannot see");
    expect(updateMessage).not.toContain("beta");

    mockAuthenticatedSession(owner);
    const ownerRefused = await done(tasks.a1.id);
    expect(ownerRefused.status).toBe(409);
    expect(await ownerRefused.text()).toContain("beta-1");
  });

  it("shows top-level board blockers to a member without board-project access", async () => {
    const { member, workspace, board, tasks } = await seed({
      boardAccess: false,
    });
    const [t10] = await db
      .insert(schema.taskTable)
      .values({ projectId: board.id, number: 10, title: "Waits on mine" })
      .returning();
    await db.insert(schema.taskRelationTable).values([
      {
        sourceTaskId: tasks.a1.id,
        targetTaskId: t10.id,
        relationType: "blocks",
      },
      {
        sourceTaskId: tasks.t8.id,
        targetTaskId: tasks.a7.id,
        relationType: "blocks",
      },
    ]);
    mockAuthenticatedSession(member);
    const { app } = createApp();

    // Board: a feature and a top-level task as blockers are named, not counted.
    const boardResponse = await app.request(
      `/api/board/workspace/${workspace.id}`,
    );
    const byId = flatten(
      ((await boardResponse.json()) as { tasks: Item[] }).tasks,
    );
    expect(byId.get(tasks.t6.id)).toMatchObject({
      waitsOn: [{ id: tasks.f1.id, key: "T-1" }],
      hiddenBlockers: 0,
    });
    expect(byId.get(tasks.a7.id)).toMatchObject({
      waitsOn: [{ id: tasks.t8.id, key: "T-8" }],
      hiddenBlockers: 0,
    });

    // Assigned tasks: waitsOn and waiting both include board tasks.
    const assigned = await app.request(
      `/api/task/assigned?workspaceId=${workspace.id}`,
    );
    const mine = new Map(
      ((await assigned.json()) as { tasks: AssignedTask[] }).tasks.map((t) => [
        t.id,
        t,
      ]),
    );
    expect(mine.get(tasks.a7.id)).toMatchObject({
      waitsOn: [{ id: tasks.t8.id, key: "T-8" }],
      hiddenBlockers: 0,
    });
    expect(mine.get(tasks.a1.id)).toMatchObject({
      waiting: [{ id: t10.id, key: "T-10" }],
      hiddenBlockers: 1,
    });

    // The 409 names the board blocker by key.
    const refused = await app.request(`/api/task/status/${tasks.a7.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "done" }),
    });
    expect(refused.status).toBe(409);
    const message = await refused.text();
    expect(message).toContain("T-8");
    expect(message).not.toContain("cannot see");
  });

  it("lets a task with only done or archived blockers be finished", async () => {
    const { owner, tasks } = await seed();
    mockAuthenticatedSession(owner);
    const { app } = createApp();

    // t5 waits on a3 (open). Finish a3's blocker a7 first, then a3, then t5.
    for (const id of [tasks.a7.id, tasks.a3.id, tasks.t5.id, tasks.t7.id]) {
      const response = await app.request(`/api/task/status/${id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "done" }),
      });
      expect(response.status, id).toBe(200);
    }
  });
});
