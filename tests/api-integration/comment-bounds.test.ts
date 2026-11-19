import { beforeEach, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

beforeEach(resetTestDatabase);

it("bounds both comment writes without changing stored content", async () => {
  const member = await createWorkspaceMember();
  const { project } = await createProjectFixture({
    workspaceId: member.workspace.id,
  });
  const [task] = await db
    .insert(schema.taskTable)
    .values({
      projectId: project.id,
      title: "Comment bounds",
      status: "to-do",
    })
    .returning();
  mockAuthenticatedSession(member.user);
  const { app } = createApp();
  const request = (method: string, content: string, id = task.id) =>
    app.request(`/api/comment/${id}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
  expect((await request("POST", "x".repeat(10_001))).status).toBe(400);
  expect(await db.query.activityTable.findMany()).toHaveLength(0);
  const created = await request("POST", "x".repeat(10_000));
  expect(created.status).toBe(200);
  const { id } = (await created.json()) as { id: string };
  expect((await request("PUT", "x".repeat(10_001), id)).status).toBe(400);
  expect(await db.query.activityTable.findMany()).toMatchObject([
    { id, content: "x".repeat(10_000) },
  ]);
  expect((await request("PUT", "edited", id)).status).toBe(200);
});
