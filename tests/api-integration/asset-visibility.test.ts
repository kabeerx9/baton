import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { mockAnonymousSession, mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

const { readObject } = vi.hoisted(() => ({
  readObject: vi.fn(async () => ({
    body: new Uint8Array([1, 2, 3]),
    contentType: "image/png",
    contentLength: 3,
  })),
}));
vi.mock("../../apps/api/src/storage/s3", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getPrivateObject: readObject,
}));

describe("API integration: asset visibility", () => {
  beforeEach(async () => {
    await resetTestDatabase();
    readObject.mockClear();
  });

  it("denies anonymous and other-workspace access to every project asset", async () => {
    const member = await createWorkspaceMember();
    const outsider = await createWorkspaceMember();
    const { project } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    const assets = await db
      .insert(schema.assetTable)
      .values(
        ["description", "comment"].map((surface) => ({
          workspaceId: member.workspace.id,
          projectId: project.id,
          objectKey: randomUUID(),
          filename: "image.png",
          mimeType: "image/png",
          size: 3,
          surface,
          createdBy: member.user.id,
        })),
      )
      .returning();
    const description = assets.find((a) => a.surface === "description");
    const comment = assets.find((a) => a.surface === "comment");
    const { app } = createApp();
    mockAnonymousSession();
    for (const asset of [description, comment])
      expect((await app.request(`/api/asset/${asset?.id}`)).status).toBe(401);

    mockAuthenticatedSession(outsider.user);
    for (const asset of [description, comment])
      expect((await app.request(`/api/asset/${asset?.id}`)).status).toBe(404);
    expect(readObject).not.toHaveBeenCalled();

    mockAuthenticatedSession(member.user);
    for (const asset of [description, comment]) {
      const response = await app.request(`/api/asset/${asset?.id}`);
      expect(response.status).toBe(200);
      expect(response.headers.get("cache-control")).toMatch(/^private,/);
    }
    expect(readObject).toHaveBeenCalledTimes(2);
  });
});
