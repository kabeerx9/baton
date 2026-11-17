import { randomUUID } from "node:crypto";
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
import { createApp } from "../../apps/api/src/index";
import { as } from "./helpers/change-requests";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";
import { connectMcpAgent } from "./helpers/mcp-oauth";
import { addWorkspaceMember } from "./helpers/project-access/add-workspace-member";
import { restrictToProjects } from "./helpers/project-access/restrict-to-projects";

// Runs once between the window selection and the payload, on its own
// connection, to prove both read one snapshot.
const hooks = vi.hoisted(() => ({
  beforePayload: null as null | (() => Promise<void>),
}));
vi.mock(
  "../../apps/api/src/board/controllers/get-visible-projects",
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import("../../apps/api/src/board/controllers/get-visible-projects")
      >();
    return {
      ...actual,
      // Runs after the window selection and before any payload read.
      getVisibleProjects: async (
        ...args: Parameters<typeof actual.getVisibleProjects>
      ) => {
        const hook = hooks.beforePayload;
        hooks.beforePayload = null;
        if (hook) await hook();
        return actual.getVisibleProjects(...args);
      },
    };
  },
);

type Item = {
  id: string;
  key: string;
  status: string;
  column: string;
  finishedAt: string | null;
  subtasks: Item[];
};
type Board = {
  tasks: Item[];
  olderDoneCount: number;
  doneSince: string;
};
type Send = (path: string, init?: RequestInit) => Promise<Response> | Response;

const DAY = 24 * 60 * 60 * 1000;
// A cutoff in the past, so the future clamp never applies.
const CUTOFF = new Date("2026-01-15T00:00:00.000Z");
const at = (days: number) => new Date(CUTOFF.getTime() + days * DAY);
const OLD = at(-30);

async function seed() {
  const { user: owner, workspace } = await createWorkspaceMember({
    role: "owner",
  });
  const board = await ensureBoardProject(workspace.id);
  const { project: alpha } = await createProjectFixture({
    workspaceId: workspace.id,
    slug: "ALPHA",
  });
  const { project: secret } = await createProjectFixture({
    workspaceId: workspace.id,
    slug: "SEC",
  });
  const member = await addWorkspaceMember(workspace.id);
  await restrictToProjects(workspace.id, member.id, [alpha.id, board.id]);

  let n = 0;
  const insert = async (
    projectId: string,
    status = "to-do",
    extra: Partial<typeof schema.taskTable.$inferInsert> = {},
  ) => {
    const [task] = await db
      .insert(schema.taskTable)
      .values({
        projectId,
        number: ++n,
        title: `Task ${n}`,
        status,
        updatedAt: OLD,
        ...extra,
      })
      .returning();
    return task;
  };
  const moved = async (task: { id: string }, newStatus: string, when: Date) =>
    db.insert(schema.activityTable).values({
      taskId: task.id,
      type: "status_changed",
      createdAt: when,
      eventData: { oldStatus: "to-do", newStatus },
    });
  const done = async (projectId: string, when: Date) => {
    const task = await insert(projectId, "done");
    await moved(task, "done", when);
    return task;
  };
  const sub = (parent: { id: string }, child: { id: string }) =>
    db.insert(schema.taskRelationTable).values({
      sourceTaskId: parent.id,
      targetTaskId: child.id,
      relationType: "subtask",
    });

  const oldDone = await done(board.id, at(-1));
  const newDone = await done(board.id, at(1));
  // No status change logged: the finish time falls back to updatedAt.
  const noActivity = await insert(board.id, "done", { updatedAt: at(-5) });
  const open = await insert(board.id);
  const boundary = await done(board.id, CUTOFF);
  const reopenedRecent = await insert(board.id, "done");
  await moved(reopenedRecent, "done", at(-10));
  await moved(reopenedRecent, "to-do", at(-9));
  await moved(reopenedRecent, "done", at(2));
  const reopenedOld = await insert(board.id, "done");
  await moved(reopenedOld, "done", at(-10));
  await moved(reopenedOld, "to-do", at(-9));
  await moved(reopenedOld, "done", at(-8));

  const allDoneOld = await insert(board.id);
  const allDoneKids = [
    await done(alpha.id, at(-3)),
    await done(alpha.id, at(-2)),
  ];
  for (const kid of allDoneKids) await sub(allDoneOld, kid);

  const oneOpen = await insert(board.id);
  const longDoneKid = await done(alpha.id, at(-200));
  const openKid = await insert(alpha.id);
  await sub(oneOpen, longDoneKid);
  await sub(oneOpen, openKid);

  // Its only open task is in a repo the member cannot see.
  const hiddenOpen = await insert(board.id);
  const hiddenOpenKid = await insert(secret.id);
  const visibleDoneKid = await done(alpha.id, at(-4));
  await sub(hiddenOpen, hiddenOpenKid);
  await sub(hiddenOpen, visibleDoneKid);

  // Only hidden tasks: for the member it is a plain task with its own status.
  const onlyHiddenTodo = await insert(board.id);
  await sub(onlyHiddenTodo, await done(secret.id, at(-6)));
  const onlyHiddenDone = await insert(board.id, "done", { updatedAt: at(-7) });
  await sub(onlyHiddenDone, await insert(secret.id));

  const orphan = await insert(alpha.id);

  // Another workspace never shows up, nor in the count.
  const other = await createWorkspaceMember({ role: "owner" });
  const otherBoard = await ensureBoardProject(other.workspace.id);
  await done(otherBoard.id, at(-40));
  await insert(otherBoard.id);

  return {
    owner,
    member,
    other: other.user,
    workspace,
    alpha,
    t: {
      oldDone,
      newDone,
      noActivity,
      open,
      boundary,
      reopenedRecent,
      reopenedOld,
      allDoneOld,
      oneOpen,
      hiddenOpen,
      onlyHiddenTodo,
      onlyHiddenDone,
      orphan,
    },
    kids: { allDoneKids, longDoneKid, openKid, hiddenOpenKid },
  };
}

async function readBoard(send: Send, workspaceId: string, doneSince?: Date) {
  const query = doneSince
    ? `?doneSince=${encodeURIComponent(doneSince.toISOString())}`
    : "";
  const response = await send(`/api/board/workspace/${workspaceId}${query}`);
  expect(response.status).toBe(200);
  return (await response.json()) as Board;
}

/** Today's client rule (`splitDone` over `column` and `finishedAt`). */
function clientSplit(tasks: Item[], cutoff: Date) {
  const hidden = tasks.filter(
    (t) =>
      t.column === "done" &&
      t.finishedAt !== null &&
      new Date(t.finishedAt).getTime() < cutoff.getTime(),
  );
  return {
    kept: tasks.filter((t) => !hidden.includes(t)).map((t) => t.id),
    olderCount: hidden.length,
  };
}

describe("API integration: the board's done window", () => {
  beforeEach(resetTestDatabase);
  afterEach(() => {
    hooks.beforePayload = null;
    vi.unstubAllGlobals();
  });

  it("keeps the same items the client rule kept, per viewer", async () => {
    const f = await seed();
    const ids = (tasks: Item[]) => tasks.map((t) => t.id);
    for (const user of [f.owner, f.member]) {
      const send = as(user);
      const full = await readBoard(send, f.workspace.id, new Date(0));
      expect(full.olderDoneCount).toBe(0);
      const windowed = await readBoard(send, f.workspace.id, CUTOFF);
      const expected = clientSplit(full.tasks, CUTOFF);
      expect(ids(windowed.tasks)).toEqual(expected.kept);
      expect(windowed.olderDoneCount).toBe(expected.olderCount);
      expect(windowed.doneSince).toBe(CUTOFF.toISOString());
    }
  });

  it("keeps and leaves out the expected items for each viewer", async () => {
    const f = await seed();
    const kept = async (user: { id: string }) =>
      (await readBoard(as(user), f.workspace.id, CUTOFF)).tasks.map(
        (t) => t.id,
      );
    const { t } = f;
    const always = [
      t.newDone.id,
      t.open.id,
      t.boundary.id,
      t.reopenedRecent.id,
    ];
    expect(await kept(f.member)).toEqual(
      [...always, t.oneOpen.id, t.onlyHiddenTodo.id].sort(byNumber(f)),
    );
    expect(await kept(f.owner)).toEqual(
      [...always, t.oneOpen.id, t.hiddenOpen.id, t.onlyHiddenDone.id].sort(
        byNumber(f),
      ),
    );
    expect(
      (await readBoard(as(f.member), f.workspace.id, CUTOFF)).olderDoneCount,
    ).toBe(6);
    expect(
      (await readBoard(as(f.owner), f.workspace.id, CUTOFF)).olderDoneCount,
    ).toBe(5);
  });

  it("keeps every task of a kept feature, however long ago it finished", async () => {
    const f = await seed();
    const board = await readBoard(as(f.owner), f.workspace.id, CUTOFF);
    const feature = board.tasks.find((t) => t.id === f.t.oneOpen.id);
    expect(feature?.subtasks.map((s) => s.id).sort()).toEqual(
      [f.kids.longDoneKid.id, f.kids.openKid.id].sort(),
    );
  });

  it("uses a 14-day default, rejects a bad value and clamps a future one", async () => {
    const f = await seed();
    const send = as(f.owner);
    const before = Date.now();
    const plain = await readBoard(send, f.workspace.id);
    const since = new Date(plain.doneSince).getTime();
    expect(since).toBeGreaterThanOrEqual(before - 14 * DAY - 1000);
    expect(since).toBeLessThanOrEqual(Date.now() - 14 * DAY + 1000);
    // Everything seeded finished long before the default window.
    expect(plain.tasks.map((t) => t.id)).not.toContain(f.t.newDone.id);

    const bad = await send(
      `/api/board/workspace/${f.workspace.id}?doneSince=yesterday`,
    );
    expect(bad.status).toBe(400);

    const future = await readBoard(
      send,
      f.workspace.id,
      new Date("2999-01-01"),
    );
    expect(new Date(future.doneSince).getTime()).toBeLessThanOrEqual(
      Date.now(),
    );
  });

  it("brings an old item back when it reopens or gains an open task", async () => {
    const f = await seed();
    const send = as(f.owner);
    const ids = async () =>
      (await readBoard(send, f.workspace.id, CUTOFF)).tasks.map((t) => t.id);
    expect(await ids()).not.toContain(f.t.oldDone.id);
    expect(await ids()).not.toContain(f.t.allDoneOld.id);

    await db
      .update(schema.taskTable)
      .set({ status: "to-do" })
      .where(eq(schema.taskTable.id, f.t.oldDone.id));
    const [late] = await db
      .insert(schema.taskTable)
      .values({ projectId: f.alpha.id, number: 900, title: "Late task" })
      .returning();
    await db.insert(schema.taskRelationTable).values({
      sourceTaskId: f.t.allDoneOld.id,
      targetTaskId: late.id,
      relationType: "subtask",
    });

    expect(await ids()).toEqual(
      expect.arrayContaining([f.t.oldDone.id, f.t.allDoneOld.id]),
    );
  });

  it("selects and loads from one snapshot", async () => {
    const f = await seed();
    hooks.beforePayload = async () => {
      // Committed on another connection after the selection ran.
      await db
        .update(schema.taskTable)
        .set({ status: "to-do" })
        .where(eq(schema.taskTable.id, f.t.oldDone.id));
      await db
        .update(schema.taskTable)
        .set({ status: "in-progress" })
        .where(eq(schema.taskTable.id, f.t.newDone.id));
    };
    const board = await readBoard(as(f.owner), f.workspace.id, CUTOFF);
    expect(hooks.beforePayload).toBeNull();
    const newDone = board.tasks.find((t) => t.id === f.t.newDone.id);
    expect(newDone).toMatchObject({ status: "done", column: "done" });
    expect(board.tasks.map((t) => t.id)).not.toContain(f.t.oldDone.id);
    expect(board.olderDoneCount).toBe(5);
    // The next read sees both changes.
    const next = await readBoard(as(f.owner), f.workspace.id, CUTOFF);
    expect(next.tasks.find((t) => t.id === f.t.newDone.id)?.status).toBe(
      "in-progress",
    );
    expect(next.tasks.map((t) => t.id)).toContain(f.t.oldDone.id);
  });
});

describe("API integration: one board item", () => {
  beforeEach(resetTestDatabase);
  afterEach(() => vi.unstubAllGlobals());

  const item = async (send: Send, workspaceId: string, key: string) =>
    send(`/api/board/workspace/${workspaceId}/item/${key}`);

  it("returns an old done feature with all its tasks, and its parent for a task key", async () => {
    const f = await seed();
    const send = as(f.owner);
    const featureKey = `T-${f.t.allDoneOld.number}`;
    const byFeature = await item(send, f.workspace.id, featureKey);
    expect(byFeature.status).toBe(200);
    const { task } = (await byFeature.json()) as { task: Item };
    expect(task).toMatchObject({ id: f.t.allDoneOld.id, column: "done" });
    expect(task.subtasks.map((s) => s.id).sort()).toEqual(
      f.kids.allDoneKids.map((k) => k.id).sort(),
    );

    const kidKey = `ALPHA-${f.kids.allDoneKids[0].number}`;
    const byKid = (await (await item(send, f.workspace.id, kidKey)).json()) as {
      task: Item;
    };
    expect(byKid.task.id).toBe(f.t.allDoneOld.id);

    const byId = (await (
      await item(send, f.workspace.id, f.t.allDoneOld.id)
    ).json()) as { task: Item };
    expect(byId.task.id).toBe(f.t.allDoneOld.id);
  });

  it("answers a key whose number no task can have with 404, on read and update", async () => {
    const f = await seed();
    const send = as(f.owner);
    for (const key of ["T-99999999999", "T-2147483648"]) {
      const read = await item(send, f.workspace.id, key);
      expect(read.status, `GET ${key}`).toBe(404);
      const update = await send(
        `/api/board/workspace/${f.workspace.id}/item/${key}`,
        { method: "PATCH", body: JSON.stringify({ status: "done" }) },
      );
      expect(update.status, `PATCH ${key}`).toBe(404);
    }
  });

  it("returns null for a repo task outside any feature", async () => {
    const f = await seed();
    const response = await item(
      as(f.owner),
      f.workspace.id,
      `ALPHA-${f.t.orphan.number}`,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ task: null });
  });

  it("refuses another workspace's member as the board does", async () => {
    const f = await seed();
    const send = as(f.other);
    const response = await item(send, f.workspace.id, "T-1");
    const board = await send(`/api/board/workspace/${f.workspace.id}`);
    expect([403, 404]).toContain(response.status);
    expect(response.status).toBe(board.status);
    expect(await response.text()).not.toContain(f.t.oldDone.id);
  });

  it("answers a hidden repo task's key as a missing one, without its parent", async () => {
    const f = await seed();
    const send = as(f.member);
    const hiddenKey = `SEC-${f.kids.hiddenOpenKid.number}`;
    const hidden = await item(send, f.workspace.id, hiddenKey);
    const missing = await item(send, f.workspace.id, "SEC-9999");
    expect(hidden.status).toBe(404);
    expect(missing.status).toBe(404);
    const hiddenBody = await hidden.text();
    expect(hiddenBody.replace(hiddenKey, "KEY")).toBe(
      (await missing.text()).replace("SEC-9999", "KEY"),
    );
    expect(hiddenBody).not.toContain(f.t.hiddenOpen.id);
    // The owner can see it and gets its feature.
    const seen = (await (
      await item(as(f.owner), f.workspace.id, hiddenKey)
    ).json()) as { task: Item };
    expect(seen.task.id).toBe(f.t.hiddenOpen.id);
  });

  it("shows the member only the tasks they can see under the feature", async () => {
    const f = await seed();
    const { task } = (await (
      await item(as(f.member), f.workspace.id, `T-${f.t.hiddenOpen.number}`)
    ).json()) as { task: Item };
    expect(task.subtasks.map((s) => s.key)).not.toContain(
      `SEC-${f.kids.hiddenOpenKid.number}`,
    );
  });
});

describe("API integration: linked tasks outside the window", () => {
  beforeEach(resetTestDatabase);

  it("says whether each linked task is open by the board's rule", async () => {
    const f = await seed();
    const link = (source: { id: string }) =>
      db.insert(schema.taskRelationTable).values({
        sourceTaskId: source.id,
        targetTaskId: f.t.open.id,
        relationType: "blocks",
      });
    // Stored status "to-do", but every task under it is done.
    await link(f.t.allDoneOld);
    await link(f.t.oneOpen);
    await link(f.t.oldDone);
    const response = await as(f.owner)(`/api/task-relation/${f.t.open.id}`);
    expect(response.status).toBe(200);
    const relations = (await response.json()) as Array<{
      sourceTask: { id: string; status: string; open: boolean };
    }>;
    const openOf = new Map(
      relations.map((r) => [r.sourceTask.id, r.sourceTask.open]),
    );
    expect(openOf.get(f.t.allDoneOld.id)).toBe(false);
    expect(openOf.get(f.t.oneOpen.id)).toBe(true);
    expect(openOf.get(f.t.oldDone.id)).toBe(false);
  });
});

describe("API integration: an agent reaches an old feature's tasks", () => {
  beforeEach(resetTestDatabase);
  afterEach(() => vi.unstubAllGlobals());

  it("get_task_by_ticket_id adds the visible tasks of a feature get_board leaves out", async () => {
    const { app } = createApp();
    const realFetch = globalThis.fetch;
    vi.stubGlobal("fetch", (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      if (url.pathname.startsWith("/api/"))
        return app.request(`${url.pathname}${url.search}`, init);
      return realFetch(input, init);
    });
    const signUp = await app.request("/api/auth/sign-up/email", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:5173",
      },
      body: JSON.stringify({
        name: "Agent owner",
        email: `${randomUUID()}@example.com`,
        password: "done-window-mcp-password",
      }),
    });
    expect(signUp.status).toBe(200);
    const person = (await signUp.json()) as {
      token: string;
      user: { id: string };
    };
    const { workspace } = await createWorkspaceMember();
    await db.insert(schema.workspaceUserTable).values({
      workspaceId: workspace.id,
      userId: person.user.id,
      role: "owner",
      joinedAt: new Date(),
    });
    const board = await ensureBoardProject(workspace.id);
    const { project: alpha } = await createProjectFixture({
      workspaceId: workspace.id,
      slug: "ALPHA",
    });
    const [feature] = await db
      .insert(schema.taskTable)
      .values({ projectId: board.id, number: 1, title: "Old feature" })
      .returning();
    for (const number of [1, 2]) {
      const [kid] = await db
        .insert(schema.taskTable)
        .values({
          projectId: alpha.id,
          number,
          title: `Old task ${number}`,
          status: "done",
          updatedAt: OLD,
        })
        .returning();
      await db.insert(schema.taskRelationTable).values({
        sourceTaskId: feature.id,
        targetTaskId: kid.id,
        relationType: "subtask",
      });
    }
    const agent = await connectMcpAgent(app, { bearer: person.token });

    const call = async (name: string, args: Record<string, unknown>) => {
      const response = await app.request("/api/mcp", {
        method: "POST",
        headers: {
          accept: "application/json, text/event-stream",
          authorization: `Bearer ${agent.accessToken}`,
          "content-type": "application/json",
          "mcp-method": "tools/call",
          "mcp-name": name,
          "mcp-protocol-version": "2026-07-28",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/call",
          params: {
            name,
            arguments: args,
            _meta: {
              "io.modelcontextprotocol/protocolVersion": "2026-07-28",
              "io.modelcontextprotocol/clientInfo": {
                name: "baton-done-window-test",
                version: "1.0.0",
              },
              "io.modelcontextprotocol/clientCapabilities": {},
            },
          },
        }),
      });
      expect(response.status).toBe(200);
      const text = await response.text();
      const data =
        text
          .split("\n")
          .find((line) => line.startsWith("data: "))
          ?.slice(6) ?? text;
      const body = JSON.parse(data) as {
        result: { isError?: boolean; content: Array<{ text: string }> };
      };
      expect(body.result.isError, body.result.content[0]?.text).toBeFalsy();
      return JSON.parse(body.result.content[0].text);
    };

    const onBoard = await call("get_board", { workspaceId: workspace.id });
    expect(onBoard.tasks).toEqual([]);
    expect(onBoard.olderDoneCount).toBe(1);

    const read = await call("get_task_by_ticket_id", {
      ticketId: "T-1",
      workspaceId: workspace.id,
    });
    expect(read.id).toBe(feature.id);
    expect(read.subtasks.map((s: { key: string }) => s.key).sort()).toEqual([
      "ALPHA-1",
      "ALPHA-2",
    ]);
  });
});

function byNumber(f: Awaited<ReturnType<typeof seed>>) {
  const numberOf = new Map(
    Object.values(f.t).map((task) => [task.id, task.number ?? 0]),
  );
  return (a: string, b: string) =>
    (numberOf.get(a) ?? 0) - (numberOf.get(b) ?? 0);
}
