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
import {
  as,
  changeRequestFixture,
  createKey,
  readTask,
  withKey,
} from "./helpers/change-requests";
import { resetTestDatabase } from "./helpers/database";
import { createProjectFixture } from "./helpers/fixtures";
import { restrictToProjects } from "./helpers/project-access/restrict-to-projects";

// B2: every owner change needs task:assign, narrowed by the API key scope,
// before involvement counts.

beforeEach(resetTestDatabase);
afterEach(() => vi.restoreAllMocks());

const READ_UPDATE = { task: ["read", "update"], project: ["read"] };

async function boardFixture() {
  const f = await changeRequestFixture("T");
  await db
    .update(schema.projectTable)
    .set({ kind: "board" })
    .where(eq(schema.projectTable.id, f.project.id));
  const path = `/api/board/workspace/${f.workspace.id}/item/T-1`;
  const clearOwner = { method: "PATCH", body: JSON.stringify({ owner: null }) };
  return { ...f, path, clearOwner };
}

describe("owner changes need task:assign", () => {
  it("refuses an involved member without task:assign on the board", async () => {
    const f = await boardFixture();
    const response = await as(f.assignee)(f.path, f.clearOwner);
    expect(response.status).toBe(403);
    expect((await readTask(f.task.id))?.userId).toBe(f.assignee.id);
  });

  it("refuses an involved admin whose key only reads and updates", async () => {
    const f = await boardFixture();
    await db
      .update(schema.taskTable)
      .set({ createdBy: f.admin.id })
      .where(eq(schema.taskTable.id, f.task.id));
    const { key } = await createKey(f.admin.id, READ_UPDATE);
    const response = await withKey(key)(f.path, f.clearOwner);
    expect(response.status).toBe(403);
    expect((await readTask(f.task.id))?.userId).toBe(f.assignee.id);

    const { key: full } = await createKey(f.admin.id);
    expect((await withKey(full)(f.path, f.clearOwner)).status).toBe(200);
    expect((await readTask(f.task.id))?.userId).toBeNull();
  });

  it("refuses a move that drops the owner without task:assign", async () => {
    const f = await changeRequestFixture();
    const destination = await createProjectFixture({
      workspaceId: f.workspace.id,
    });
    await restrictToProjects(f.workspace.id, f.assignee.id, [f.project.id]);
    const move = { destinationProjectId: destination.project.id };
    const send = (request: ReturnType<typeof withKey>) =>
      request(`/api/task/move/${f.task.id}`, {
        method: "PUT",
        body: JSON.stringify({ ...move, destinationStatus: "to-do" }),
      });

    const { key } = await createKey(f.admin.id, READ_UPDATE);
    expect((await send(withKey(key))).status).toBe(403);
    expect(await readTask(f.task.id)).toMatchObject({
      projectId: f.project.id,
      userId: f.assignee.id,
    });

    expect((await send(as(f.admin))).status).toBe(200);
    expect(await readTask(f.task.id)).toMatchObject({
      projectId: destination.project.id,
      userId: null,
    });
  });
});
