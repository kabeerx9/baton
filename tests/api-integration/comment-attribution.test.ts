import { createHash, randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { mockAnonymousSession, mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

beforeEach(resetTestDatabase);

async function taskFor(role: "member" | "admin") {
  const member = await createWorkspaceMember({ role });
  const { project } = await createProjectFixture({
    workspaceId: member.workspace.id,
  });
  const [task] = await db
    .insert(schema.taskTable)
    .values({
      projectId: project.id,
      title: "Task",
      status: "to-do",
      number: 1,
    })
    .returning();
  return { member, task };
}

const spoof = {
  content: "Imported",
  externalSource: "github",
  externalUserName: "Executive",
};

// Comment attribution to an outside author belonged to the removed importers.
describe("external comment attribution", () => {
  it("stores a member's comment as their own and drops attribution fields", async () => {
    const { member, task } = await taskFor("member");
    mockAuthenticatedSession(member.user);
    const response = await createApp().app.request(`/api/comment/${task.id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(spoof),
    });
    expect(response.status).toBe(200);
    const [row] = await db.select().from(schema.activityTable);
    expect(row).toMatchObject({
      userId: member.user.id,
      externalUserName: null,
      externalSource: null,
    });
  });

  it("drops attribution fields from an admin API key with every scope", async () => {
    const { member, task } = await taskFor("admin");
    mockAnonymousSession();
    const key = `test_${randomUUID()}`;
    await db.insert(schema.apikeyTable).values({
      referenceId: member.user.id,
      userId: member.user.id,
      key: createHash("sha256").update(key).digest("base64url"),
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      permissions: JSON.stringify({
        task: ["update"],
        workspace: ["manage_settings"],
      }),
    });
    const response = await createApp().app.request(`/api/comment/${task.id}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(spoof),
    });
    expect(response.status).toBe(200);
    const [row] = await db.select().from(schema.activityTable);
    expect(row).toMatchObject({
      userId: member.user.id,
      externalUserName: null,
      externalSource: null,
    });
  });
});
