import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

beforeEach(async () => {
  await resetTestDatabase();
  vi.clearAllMocks();
});
describe("github import permissions", () => {
  it.each(["github"])("%s denies a create-only custom role", async (type) => {
    const member = await createWorkspaceMember({ role: "importer" });
    await db.insert(schema.workspaceRoleTable).values({
      workspaceId: member.workspace.id,
      role: "importer",
      permission: JSON.stringify({ task: ["create"] }),
    });
    const { project } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    mockAuthenticatedSession(member.user);
    const { app } = createApp();
    const response = await app.request(
      `/api/${type}-integration/import-issues`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: project.id }),
      },
    );
    expect(response.status).toBe(403);
  });
});
