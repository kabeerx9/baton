// Races around the viewer's per-task check (task:update_assigned). The
// check must run under the task lock in the write's own transaction, and
// take the repo's lock order (workspace, project, task) so a workspace
// delete cannot deadlock with it.
import { eq } from "drizzle-orm";
import { Client } from "pg";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { S3Client } from "../../apps/api/node_modules/@aws-sdk/client-s3";
import db, { schema } from "../../apps/api/src/database";
import { as } from "./helpers/change-requests";
import { resetTestDatabase } from "./helpers/database";
import { createWorkspaceMember } from "./helpers/fixtures";
import { holdRowLock, waitForLockWaiters } from "./helpers/row-lock";
import { seedViewerBoard } from "./helpers/viewer-board";

beforeEach(resetTestDatabase);
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

const json = (method: string, body: unknown): RequestInit => ({
  method,
  body: JSON.stringify(body),
});

async function connect() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  return client;
}

/** Reassigns `taskId` in an open transaction that holds its row lock. */
async function reassignInFlight(taskId: string, userId: string) {
  const client = await connect();
  await client.query("BEGIN");
  await client.query('UPDATE "task" SET "assignee_id" = $1 WHERE "id" = $2', [
    userId,
    taskId,
  ]);
  return {
    async commit() {
      try {
        await client.query("COMMIT");
      } finally {
        await client.end();
      }
    },
  };
}

describe("reassignment overlapping the viewer's write", () => {
  it("a comment queued behind a reassignment is refused, not written", async () => {
    const f = await seedViewerBoard();
    const reassign = await reassignInFlight(f.own.id, f.member.id);
    let pending: Promise<Response> | undefined;
    try {
      pending = as(f.viewer)(
        `/api/comment/${f.own.id}`,
        json("POST", { content: "Mine?" }),
      );
      await waitForLockWaiters(1);
    } finally {
      await reassign.commit();
    }
    const response = await pending!;
    expect(response.status).toBe(403);
    expect(
      await db
        .select()
        .from(schema.activityTable)
        .where(eq(schema.activityTable.taskId, f.own.id)),
    ).toHaveLength(0);
  });

  it("a label attach queued behind a reassignment is refused, not written", async () => {
    const f = await seedViewerBoard();
    const reassign = await reassignInFlight(f.own.id, f.member.id);
    let pending: Promise<Response> | undefined;
    try {
      pending = as(f.viewer)(
        `/api/label/${f.label.id}/task`,
        json("PUT", { taskId: f.own.id }),
      );
      await waitForLockWaiters(1);
    } finally {
      await reassign.commit();
    }
    expect((await pending!).status).toBe(403);
    expect(
      await db
        .select()
        .from(schema.labelTable)
        .where(eq(schema.labelTable.taskId, f.own.id)),
    ).toHaveLength(0);
  });

  it("an upload finalize is judged again after storage verification", async () => {
    vi.stubEnv("S3_ENDPOINT", "https://storage.example.test");
    vi.stubEnv("S3_BUCKET", "local-test-bucket");
    vi.stubEnv("S3_ACCESS_KEY_ID", "local-test-key");
    vi.stubEnv("S3_SECRET_ACCESS_KEY", "local-test-secret");
    vi.stubEnv("S3_KEY_PREFIX", "");
    const f = await seedViewerBoard();
    // The task is reassigned while storage verification runs (no lock held).
    vi.spyOn(S3Client.prototype, "send").mockImplementation(async () => {
      await db
        .update(schema.taskTable)
        .set({ userId: f.member.id })
        .where(eq(schema.taskTable.id, f.own.id));
      return { ContentLength: 12, ContentType: "image/png" } as never;
    });
    const key = `workspace/${f.workspace.id}/project/${f.board.id}/task/${f.own.id}/descriptions/race.png`;
    const response = await as(f.viewer)(
      `/api/task/image-upload/${f.own.id}/finalize`,
      json("POST", {
        key,
        filename: "race.png",
        contentType: "image/png",
        size: 12,
        surface: "description",
      }),
    );
    expect(S3Client.prototype.send).toHaveBeenCalled();
    expect(response.status).toBe(403);
    expect(
      await db
        .select()
        .from(schema.assetTable)
        .where(eq(schema.assetTable.objectKey, key)),
    ).toHaveLength(0);
  });
});

describe("lock order against a workspace delete", () => {
  // A delete holds the workspace row FOR UPDATE, then removes its tasks. A
  // viewer write that waits on the workspace must not already hold the task,
  // or the delete waits on it and the two deadlock.
  for (const [name, start] of [
    [
      "label attach",
      (f: Awaited<ReturnType<typeof seedViewerBoard>>) =>
        as(f.viewer)(
          `/api/label/${f.label.id}/task`,
          json("PUT", { taskId: f.own.id }),
        ),
    ],
    [
      "comment",
      (f: Awaited<ReturnType<typeof seedViewerBoard>>) =>
        as(f.viewer)(
          `/api/comment/${f.own.id}`,
          json("POST", { content: "Hello" }),
        ),
    ],
  ] as const) {
    it(`${name} waits on the workspace before it locks the task`, async () => {
      const f = await seedViewerBoard();
      const workspace = await holdRowLock("workspace", f.workspace.id);
      let pending: Promise<Response> | undefined;
      const probe = await connect();
      try {
        pending = start(f);
        await waitForLockWaiters(1);
        // The delete's next step: lock the task. It must not wait.
        await probe.query("BEGIN");
        await probe.query("SET LOCAL lock_timeout = '2s'");
        const locked = await probe.query(
          'SELECT 1 FROM "task" WHERE "id" = $1 FOR UPDATE',
          [f.own.id],
        );
        expect(locked.rowCount).toBe(1);
        await probe.query("ROLLBACK");
      } finally {
        await probe.end();
        await workspace.release();
      }
      expect((await pending!).status).toBe(200);
    });
  }
});

describe("a repo move overlapping the viewer's write", () => {
  it("refuses with 409 when the task's repo moved to another workspace", async () => {
    const f = await seedViewerBoard();
    // The viewer belongs to the destination too, so only the move check
    // stands between the write and a row tagged with the old workspace.
    const { workspace: target } = await createWorkspaceMember();
    await db.insert(schema.workspaceUserTable).values({
      workspaceId: target.id,
      userId: f.viewer.id,
      role: "viewer",
      joinedAt: new Date(),
    });
    // A project move holds the project FOR UPDATE until it commits.
    const move = await connect();
    await move.query("BEGIN");
    await move.query('SELECT 1 FROM "project" WHERE "id" = $1 FOR UPDATE', [
      f.board.id,
    ]);
    await move.query(
      'UPDATE "project" SET "workspace_id" = $1 WHERE "id" = $2',
      [target.id, f.board.id],
    );
    let pending: Promise<Response> | undefined;
    try {
      pending = as(f.viewer)(
        `/api/comment/${f.own.id}`,
        json("POST", { content: "Mid-move" }),
      );
      await waitForLockWaiters(1);
      await move.query("COMMIT");
    } finally {
      await move.end();
    }
    const response = await pending!;
    expect(response.status).toBe(409);
    expect(
      await db
        .select()
        .from(schema.activityTable)
        .where(eq(schema.activityTable.taskId, f.own.id)),
    ).toHaveLength(0);
  });
});
