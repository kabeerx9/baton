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
import { timeOutRequest } from "../../apps/api/src/task-change-request/expire-change-requests";
import {
  changeRequestFixture,
  makeDue,
  readRequest,
  readTask,
  setStatus,
} from "./helpers/change-requests";
import { resetTestDatabase } from "./helpers/database";

// B3: archive hides a feature and ends its blocking, so an outsider's
// archive or unarchive of a feature is a request that expires.

beforeEach(resetTestDatabase);
afterEach(() => vi.restoreAllMocks());

/** Makes the fixture task a feature with an open child and a dependent. */
async function featureFixture() {
  const f = await changeRequestFixture();
  const extra = (title: string, number: number) => ({
    projectId: f.project.id,
    columnId: f.columns.todo.id,
    title,
    status: "to-do",
    number,
    position: number,
    createdBy: f.creator.id,
  });
  const [child, dependent] = await db
    .insert(schema.taskTable)
    .values([extra("Child", 2), extra("Dependent", 3)])
    .returning();
  await db.insert(schema.taskRelationTable).values([
    {
      sourceTaskId: f.task.id,
      targetTaskId: child.id,
      relationType: "subtask",
    },
    {
      sourceTaskId: f.task.id,
      targetTaskId: dependent.id,
      relationType: "blocks",
    },
  ]);
  return { ...f, child, dependent };
}

async function requestFrom(response: Response) {
  expect(response.status).toBe(202);
  const body = await response.json();
  expect(body).toMatchObject({ outcome: "requested" });
  return body.request.id as string;
}

describe("outsider archive of a feature", () => {
  it("turns an archive into a request that expires on timeout", async () => {
    const f = await featureFixture();
    const requestId = await requestFrom(
      await setStatus(f.outsider, f.task.id, "archived"),
    );
    expect((await readTask(f.task.id))?.status).toBe("to-do");

    await makeDue(requestId);
    expect(await timeOutRequest(requestId)).toBe("expired");
    expect((await readRequest(requestId))?.state).toBe("expired");
    expect((await readTask(f.task.id))?.status).toBe("to-do");
  });

  it("turns an unarchive into a request that expires on timeout", async () => {
    const f = await featureFixture();
    await db
      .update(schema.taskTable)
      .set({ status: "archived" })
      .where(eq(schema.taskTable.id, f.task.id));
    const requestId = await requestFrom(
      await setStatus(f.outsider, f.task.id, "to-do"),
    );

    await makeDue(requestId);
    expect(await timeOutRequest(requestId)).toBe("expired");
    expect((await readTask(f.task.id))?.status).toBe("archived");
  });

  it("still applies an outsider's ordinary feature status change", async () => {
    const f = await featureFixture();
    const response = await setStatus(f.outsider, f.task.id, "in-progress");
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ outcome: "applied" });
  });
});
