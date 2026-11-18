import { replayDeferredIssueEdits } from "../../apps/api/src/plugins/github/services/deferred-issue-edits";
import { replayDeferredLabelFields } from "../../apps/api/src/plugins/sync/replay-deferred-label-fields";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { getSyncIntegrations } from "../../apps/api/src/plugins/sync/integrations";
import { createInstanceAdmin } from "./helpers/admin/create-instance-admin";
import { mockAuthenticatedSession } from "./helpers/auth";
import { signUpWithSession } from "./helpers/auth-session";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";
import { projectAccessApi } from "./helpers/project-access/project-access-api";
import { createTestApiKey } from "./helpers/api-key";

vi.mock("../../apps/api/src/storage/s3", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getPrivateObject: vi.fn(async () => ({
    body: new Uint8Array([1, 2, 3]),
    contentType: "image/png",
    contentLength: 3,
  })),
}));

beforeEach(resetTestDatabase);

function setArchived(workspaceId: string, archived: boolean) {
  return db
    .update(schema.workspaceTable)
    .set({ archivedAt: archived ? new Date() : null })
    .where(eq(schema.workspaceTable.id, workspaceId));
}

async function codeOf(response: Response) {
  return ((await response.json()) as { code?: string }).code;
}

async function seed() {
  const { user: member, workspace } = await createWorkspaceMember({
    role: "owner",
  });
  const { project } = await createProjectFixture({ workspaceId: workspace.id });
  const [task] = await db
    .insert(schema.taskTable)
    .values({ projectId: project.id, title: "Task", number: 1 })
    .returning();
  await db
    .update(schema.projectTable)
    .set({ lastTaskNumber: 1 })
    .where(eq(schema.projectTable.id, project.id));
  return { member, workspace, project, task };
}

describe("an archived workspace over HTTP", () => {
  it("returns WORKSPACE_ARCHIVED to members and administrators, and 404 to outsiders", async () => {
    const { member, workspace, project, task } = await seed();
    const outsider = await createWorkspaceMember();
    const admin = await createInstanceAdmin();
    const paths = [
      `/project?workspaceId=${workspace.id}`,
      `/project/${project.id}`,
      `/task/${task.id}`,
      `/workspace/${workspace.id}/capabilities`,
      `/workspace/${workspace.id}`,
    ];

    mockAuthenticatedSession(member);
    for (const path of paths) {
      expect((await projectAccessApi()(path)).status).toBe(200);
    }

    await setArchived(workspace.id, true);
    for (const user of [member, admin]) {
      vi.restoreAllMocks();
      mockAuthenticatedSession(user);
      for (const path of paths) {
        const response = await projectAccessApi()(path);
        expect(response.status, `${path} for ${user.id}`).toBe(403);
        expect(await codeOf(response)).toBe("WORKSPACE_ARCHIVED");
      }
    }

    vi.restoreAllMocks();
    mockAuthenticatedSession(outsider.user);
    for (const path of paths) {
      expect((await projectAccessApi()(path)).status).toBe(404);
    }
  });

  it("drops it from the member's workspace list until it is restored", async () => {
    const { member, workspace } = await seed();
    mockAuthenticatedSession(member);
    const listIds = async () =>
      (
        (await (await projectAccessApi()("/workspace")).json()) as {
          id: string;
        }[]
      ).map((entry) => entry.id);

    expect(await listIds()).toEqual([workspace.id]);
    await setArchived(workspace.id, true);
    expect(await listIds()).toEqual([]);
    await setArchived(workspace.id, false);
    expect(await listIds()).toEqual([workspace.id]);
  });

  it("rejects the member's API keys, which MCP clients use", async () => {
    const { member, workspace, task } = await seed();
    const { key } = await createTestApiKey({
      userId: member.id,
      name: "Archive test",
    });
    const { app } = createApp();
    const request = (headers: Record<string, string>) =>
      app.request(`/api/task/${task.id}`, { headers });

    expect((await request({ "x-api-key": key })).status).toBe(200);
    await setArchived(workspace.id, true);
    for (const headers of [
      { "x-api-key": key },
      { authorization: `Bearer ${key}` },
    ]) {
      const response = await request(headers);
      expect(response.status).toBe(403);
      expect(await codeOf(response)).toBe("WORKSPACE_ARCHIVED");
    }
  });

  it("hides its notifications until it is restored", async () => {
    const { member, workspace, task } = await seed();
    await db.insert(schema.notificationTable).values({
      userId: member.id,
      title: "Task notification",
      type: "task_assigned",
      resourceId: task.id,
      resourceType: "task",
    });
    mockAuthenticatedSession(member);
    const count = async () =>
      ((await (await projectAccessApi()("/notification")).json()) as unknown[])
        .length;

    expect(await count()).toBe(1);
    await setArchived(workspace.id, true);
    expect(await count()).toBe(0);
    await setArchived(workspace.id, false);
    expect(await count()).toBe(1);
  });

  it("hides ticket-ID lookups from members and API keys until restore", async () => {
    const { member, workspace, project, task } = await seed();
    const { key } = await createTestApiKey({ userId: member.id });
    mockAuthenticatedSession(member);
    const { app } = createApp();
    const path = `/api/task/by-ticket-id/${project.slug}-1`;
    const headers = [
      {},
      { "x-api-key": key },
      { authorization: `Bearer ${key}` },
    ];
    const selectors = [
      "",
      `?workspaceId=${workspace.id}`,
      `?workspaceSlug=${workspace.slug}`,
      `?projectId=${project.id}`,
    ];
    for (const archived of [false, true, false]) {
      await setArchived(workspace.id, archived);
      for (const credential of headers) {
        for (const selector of selectors) {
          const response = await app.request(`${path}${selector}`, {
            headers: credential,
          });
          expect(response.status).toBe(archived ? 404 : 200);
          expect(await response.json()).toMatchObject(
            archived ? { message: "Task not found" } : { id: task.id },
          );
        }
      }
    }
  });
});

describe("an archived workspace's integrations", () => {
  it("pauses deferred jobs without discarding their pending work", async () => {
    const { workspace, project, task } = await seed();
    const [integration] = await db
      .insert(schema.integrationTable)
      .values({
        projectId: project.id,
        type: "github",
        isActive: true,
        config: "{}",
      })
      .returning();
    const metadata = JSON.stringify({
      deferredIssueEdit: { id: "pending" },
      syncLabelFieldsDeferred: "pending",
    });
    const [link] = await db
      .insert(schema.externalLinkTable)
      .values({
        taskId: task.id,
        integrationId: integration.id,
        resourceType: "issue",
        externalId: "1",
        url: "https://github.com/acme/app/issues/1",
        metadata,
      })
      .returning();
    await setArchived(workspace.id, true);
    expect(await replayDeferredIssueEdits()).toMatchObject({ degraded: false });
    expect(await replayDeferredLabelFields()).toMatchObject({
      degraded: false,
    });
    const [stored] = await db
      .select()
      .from(schema.externalLinkTable)
      .where(eq(schema.externalLinkTable.id, link.id));
    expect(stored.metadata).toBe(metadata);
  });

  it("are skipped by sync lookups", async () => {
    const { workspace, project } = await seed();
    await db.insert(schema.integrationTable).values({
      projectId: project.id,
      type: "github",
      isActive: true,
      config: JSON.stringify({
        repositoryOwner: "acme",
        repositoryName: "app",
        syncRules: { taskCreated: true },
      }),
    });

    const syncedBefore = await getSyncIntegrations(project.id);

    await setArchived(workspace.id, true);
    expect(await getSyncIntegrations(project.id)).toEqual([]);

    await setArchived(workspace.id, false);
    expect(await getSyncIntegrations(project.id)).toHaveLength(
      syncedBefore.length,
    );
  });
});

describe("an archived workspace through the workspace write routes", () => {
  async function writeFixture() {
    const { app } = createApp();
    const member = await signUpWithSession(app, {
      email: "member@example.com",
      name: "Member",
    });
    const colleague = await signUpWithSession(app, {
      email: "colleague@example.com",
      name: "Colleague",
    });
    const outsider = await signUpWithSession(app, {
      email: "outsider@example.com",
      name: "Outsider",
    });
    const [workspace] = await db
      .insert(schema.workspaceTable)
      .values({
        name: "Archived org",
        slug: `archived-${randomUUID()}`,
        createdAt: new Date(),
      })
      .returning();
    await db.insert(schema.workspaceUserTable).values([
      {
        workspaceId: workspace.id,
        userId: member.userId,
        role: "owner",
        joinedAt: new Date(),
      },
      {
        workspaceId: workspace.id,
        userId: colleague.userId,
        role: "member",
        joinedAt: new Date(),
      },
    ]);
    await db.insert(schema.workspaceRoleTable).values({
      workspaceId: workspace.id,
      role: "member",
      permission: JSON.stringify({ workspace: ["read"] }),
    });
    const call = (
      cookies: string,
      method: string,
      path: string,
      body?: Record<string, unknown>,
    ) =>
      app.request(`/api${path}`, {
        method,
        headers: {
          cookie: cookies,
          origin: "http://localhost:5173",
          ...(body ? { "content-type": "application/json" } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
    return { member, colleague, outsider, workspace, call };
  }

  it("refuses every write with WORKSPACE_ARCHIVED and changes nothing", async () => {
    const { member, colleague, workspace, call } = await writeFixture();
    await setArchived(workspace.id, true);
    const base = `/workspace/${workspace.id}`;
    const writes: [string, string, Record<string, unknown>?][] = [
      ["PATCH", base, { name: "Renamed" }],
      ["DELETE", base],
      ["POST", `${base}/leave`],
      ["DELETE", `${base}/members/${colleague.userId}`],
      ["PUT", `${base}/members/${colleague.userId}/role`, { role: "admin" }],
      ["PUT", `${base}/owner`, { userId: colleague.userId }],
      ["POST", `${base}/roles`, { role: "reviewer", permission: {} }],
    ];
    for (const [method, path, body] of writes) {
      const response = await call(member.cookies, method, path, body);
      expect([method, path, response.status]).toEqual([method, path, 403]);
      expect(await codeOf(response)).toBe("WORKSPACE_ARCHIVED");
    }
    // The colleague can't leave an archived workspace either.
    const left = await call(colleague.cookies, "POST", `${base}/leave`);
    expect(left.status).toBe(403);
    expect(await codeOf(left)).toBe("WORKSPACE_ARCHIVED");

    const [stored] = await db
      .select({ name: schema.workspaceTable.name })
      .from(schema.workspaceTable)
      .where(eq(schema.workspaceTable.id, workspace.id));
    expect(stored?.name).toBe("Archived org");
    const members = await db
      .select({
        userId: schema.workspaceUserTable.userId,
        role: schema.workspaceUserTable.role,
      })
      .from(schema.workspaceUserTable)
      .where(eq(schema.workspaceUserTable.workspaceId, workspace.id));
    expect(members).toHaveLength(2);
    expect(members.find((row) => row.userId === colleague.userId)?.role).toBe(
      "member",
    );
    expect(
      await db
        .select()
        .from(schema.workspaceRoleTable)
        .where(eq(schema.workspaceRoleTable.role, "reviewer")),
    ).toEqual([]);
  });

  it("does not tell an outsider the workspace is archived", async () => {
    const { outsider, workspace, call } = await writeFixture();
    await setArchived(workspace.id, true);
    const response = await call(
      outsider.cookies,
      "PATCH",
      `/workspace/${workspace.id}`,
      { name: "Renamed" },
    );
    expect(response.status).toBe(404);
    expect(await codeOf(response)).not.toBe("WORKSPACE_ARCHIVED");
  });

  it("accepts writes again after restore", async () => {
    const { member, workspace, call } = await writeFixture();
    await setArchived(workspace.id, true);
    await setArchived(workspace.id, false);
    const response = await call(
      member.cookies,
      "PATCH",
      `/workspace/${workspace.id}`,
      { name: "Renamed" },
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ name: "Renamed" });
  });

  it("answers the removed provider organization endpoints with 404", async () => {
    const { member, workspace, call } = await writeFixture();
    await setArchived(workspace.id, true);
    for (const [method, path, body] of [
      ["GET", "/auth/organization/list"],
      [
        "GET",
        `/auth/organization/get-full-organization?organizationId=${workspace.id}`,
      ],
      [
        "POST",
        "/auth/organization/set-active",
        { organizationId: workspace.id },
      ],
      [
        "POST",
        "/auth/organization/update",
        { organizationId: workspace.id, data: { name: "Renamed" } },
      ],
    ] as [string, string, Record<string, unknown>?][]) {
      const response = await call(member.cookies, method, path, body);
      expect([path, response.status]).toEqual([path, 404]);
    }
  });
});
