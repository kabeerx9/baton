import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { ensureBoardProject } from "../../apps/api/src/board/controllers/ensure-board-project";
import { as, readTask } from "./helpers/change-requests";
import { resetTestDatabase } from "./helpers/database";
import { readErrorBody } from "./helpers/error-body";
import { createWorkspaceMember } from "./helpers/fixtures";

// Every path that writes a task title trims it, refuses a blank one and
// refuses more than 500 characters after the trim.

beforeEach(resetTestDatabase);

const MAX = 500;
const blank = "   ";
const tooLong = "x".repeat(MAX + 1);
const atLimit = ` ${"y".repeat(MAX)} `;

async function seed() {
  const { user, workspace } = await createWorkspaceMember({ role: "owner" });
  const board = await ensureBoardProject(workspace.id);
  const [task] = await db
    .insert(schema.taskTable)
    .values({
      projectId: board.id,
      title: "Original",
      status: "to-do",
      // Above the project's task counter, so created tasks never collide.
      number: 900,
      position: 1,
      createdBy: user.id,
    })
    .returning();
  return { user, workspace, board, task: task!, send: as(user) };
}

type Seed = Awaited<ReturnType<typeof seed>>;
const post = (body: unknown): RequestInit => ({
  method: "POST",
  body: JSON.stringify(body),
});
const put = (body: unknown): RequestInit => ({
  method: "PUT",
  body: JSON.stringify(body),
});

/** Each title-writing route, sending `title`. */
function titleCalls(f: Seed) {
  return {
    createTask: (title: string) =>
      f.send(
        `/api/task/${f.board.id}`,
        post({ title, description: "", priority: "low", status: "to-do" }),
      ),
    createBoardTask: (title: string) =>
      f.send(`/api/board/workspace/${f.workspace.id}`, post({ title })),
    planBoardTask: (title: string) =>
      f.send(`/api/board/workspace/${f.workspace.id}/plan`, post({ title })),
    planSubtask: (title: string) =>
      f.send(
        `/api/board/workspace/${f.workspace.id}/plan`,
        post({ title: "Feature", subtasks: [{ title }] }),
      ),
    addSubtask: (title: string) =>
      f.send(
        `/api/board/${f.task.id}/subtask`,
        post({ projectId: f.board.id, title }),
      ),
    addSubtasksByKey: (title: string) =>
      f.send(
        `/api/board/workspace/${f.workspace.id}/item/${f.task.id}/subtasks`,
        post({ subtasks: [{ title }] }),
      ),
    importTasks: (title: string) =>
      f.send(
        `/api/task/import/${f.board.id}`,
        post({ tasks: [{ title, status: "to-do" }] }),
      ),
    duplicateTask: (title: string) =>
      f.send(`/api/task/duplicate/${f.task.id}`, post({ title })),
    updateTitle: (title: string) =>
      f.send(`/api/task/title/${f.task.id}`, put({ title })),
    fullUpdate: (title: string) =>
      f.send(
        `/api/task/${f.task.id}`,
        put({
          title,
          status: "to-do",
          priority: "no-priority",
          projectId: f.board.id,
          position: 1,
        }),
      ),
  };
}

describe("task titles", () => {
  it("refuses a whitespace-only title on every path", async () => {
    const f = await seed();
    for (const [name, call] of Object.entries(titleCalls(f))) {
      const response = await call(blank);
      expect(response.status, name).toBe(400);
      expect((await readErrorBody(response)).code, name).toBe(
        "VALIDATION_ERROR",
      );
    }
    expect((await readTask(f.task.id))?.title).toBe("Original");
  });

  it("refuses a title over 500 characters on every path", async () => {
    const f = await seed();
    for (const [name, call] of Object.entries(titleCalls(f))) {
      const response = await call(tooLong);
      expect(response.status, name).toBe(400);
      const body = await readErrorBody(response);
      expect(body.code, name).toBe("VALIDATION_ERROR");
      expect(JSON.stringify(body.issues), name).toContain("500");
    }
  });

  it("trims and accepts 500 characters after the trim", async () => {
    const f = await seed();
    const created = await titleCalls(f).createBoardTask(atLimit);
    expect(created.status).toBe(200);
    const { id } = (await created.json()) as { id: string };
    expect((await readTask(id))?.title).toBe("y".repeat(MAX));

    const renamed = await titleCalls(f).updateTitle("  Renamed  ");
    expect(renamed.status).toBe(200);
    expect((await readTask(f.task.id))?.title).toBe("Renamed");
  });

  it("checks the copied title when a duplicate leaves the title out", async () => {
    const f = await seed();
    // GitHub sync stores its own titles up to 4096 characters.
    for (const stored of [tooLong, blank]) {
      await db
        .update(schema.taskTable)
        .set({ title: stored })
        .where(eq(schema.taskTable.id, f.task.id));
      const before = await db.select().from(schema.taskTable);
      const response = await f.send(
        `/api/task/duplicate/${f.task.id}`,
        post({}),
      );
      expect(response.status, stored).toBe(400);
      expect((await readErrorBody(response)).code).toBe("VALIDATION_ERROR");
      expect(await db.select().from(schema.taskTable)).toHaveLength(
        before.length,
      );
    }

    await db
      .update(schema.taskTable)
      .set({ title: "  Padded  " })
      .where(eq(schema.taskTable.id, f.task.id));
    const copied = await f.send(`/api/task/duplicate/${f.task.id}`, post({}));
    expect(copied.status).toBe(200);
    const { id } = (await copied.json()) as { id: string };
    expect((await readTask(id))?.title).toBe("Padded");
  });
});
