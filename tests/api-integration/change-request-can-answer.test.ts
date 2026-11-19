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
  requestStatus,
  withKey,
} from "./helpers/change-requests";
import { resetTestDatabase } from "./helpers/database";

// N2: canAnswer=me lists only requests the caller's role and key could
// answer: status needs task:update (or task:update_assigned on the caller's
// own task), delete needs task:delete.

beforeEach(resetTestDatabase);
afterEach(() => vi.restoreAllMocks());

/** A status request on the fixture task and a delete request on a second. */
async function twoRequests() {
  const f = await changeRequestFixture();
  const [second] = await db
    .insert(schema.taskTable)
    .values({
      projectId: f.project.id,
      columnId: f.columns.todo.id,
      title: "Second",
      status: "to-do",
      number: 2,
      position: 2,
      createdBy: f.creator.id,
      userId: f.assignee.id,
    })
    .returning();
  const statusId = await requestStatus(f.outsider, f.task.id, "in-progress");
  const response = await as(f.outsider)(`/api/task/${second.id}`, {
    method: "DELETE",
  });
  expect(response.status).toBe(202);
  const deleteId = (await response.json()).request.id as string;
  const path = `/api/task-change-request?workspaceId=${f.workspace.id}&canAnswer=me`;
  return { ...f, statusId, deleteId, path };
}

async function ids(response: Response) {
  expect(response.status).toBe(200);
  const body = (await response.json()) as { requests: { id: string }[] };
  return body.requests.map((request) => request.id).sort();
}

describe("canAnswer=me", () => {
  it("lists only status requests for an involved member without task:delete", async () => {
    const f = await twoRequests();
    expect(await ids(await as(f.assignee)(f.path))).toEqual([f.statusId]);
    expect(await ids(await as(f.creator)(f.path))).toEqual([f.statusId]);
    expect(await ids(await as(f.admin)(f.path))).toEqual(
      [f.statusId, f.deleteId].sort(),
    );
  });

  it("lists only status requests on their own tasks for a viewer assignee", async () => {
    const f = await twoRequests();
    await db
      .update(schema.workspaceUserTable)
      .set({ role: "viewer" })
      .where(eq(schema.workspaceUserTable.userId, f.assignee.id));
    // task:update_assigned answers status requests on the caller's own task;
    // a delete request still needs task:delete.
    expect(await ids(await as(f.assignee)(f.path))).toEqual([f.statusId]);
  });

  it("lists nothing for a viewer who created the task but is not its assignee", async () => {
    const f = await twoRequests();
    await db
      .update(schema.workspaceUserTable)
      .set({ role: "viewer" })
      .where(eq(schema.workspaceUserTable.userId, f.creator.id));
    expect(await ids(await as(f.creator)(f.path))).toEqual([]);
  });

  it("lists nothing for an admin's read-only API key", async () => {
    const f = await twoRequests();
    const { key } = await createKey(f.admin.id, {
      task: ["read"],
      workspace: ["read"],
    });
    expect(await ids(await withKey(key)(f.path))).toEqual([]);
  });
});
