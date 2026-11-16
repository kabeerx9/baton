import { and, eq, inArray } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { auth } from "../../apps/api/src/auth";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { providerIssue } from "../../apps/api/src/plugins/sync/provider-issue";
import { deleteUserSessions } from "../../apps/api/src/sessions/delete-user-sessions";
import getTaskByTicketId from "../../apps/api/src/task/controllers/get-task-by-ticket-id";
import { deleteAccountData } from "../../apps/api/src/user/controllers/delete-account-data";
import { deleteNativeWorkspace } from "../../apps/api/src/workspace/lifecycle/delete-native-workspace";
import { createInstanceAdmin } from "./helpers/admin/create-instance-admin";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

const github = vi.hoisted(() => ({ octokit: vi.fn() }));
vi.mock(
  "../../apps/api/src/plugins/github/utils/github-app",
  async (original) => ({
    ...(await original<object>()),
    getVerifiedInstallationOctokit: github.octokit,
  }),
);

beforeEach(async () => {
  await resetTestDatabase();
  vi.restoreAllMocks();
  github.octokit.mockReset();
});

type TourStart = {
  demoWorkspace: { id: string; slug: string; projectId: string };
  tasks: { key: string; id: string; number: number }[];
};
type User = typeof schema.userTable.$inferSelect;

function call(path: string, init?: RequestInit) {
  return createApp().app.request(`/api${path}`, init);
}
function send(method: string, path: string, body?: unknown, headers = {}) {
  return call(path, {
    method,
    headers: { "content-type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function startTourAs(user: User) {
  mockAuthenticatedSession(user);
  const response = await send("POST", "/tour/start");
  expect(response.status).toBe(200);
  return (await response.json()) as TourStart;
}

async function deliveries() {
  return db.select().from(schema.instanceWebhookDeliveryTable);
}
async function enableAuditWebhook() {
  await db.insert(schema.instanceWebhookTable).values({
    url: "https://audit.example/hook",
    categories: ["workspace"],
    signingSecret: "secret",
  });
}

describe("admin routes treat a demo workspace as not found", () => {
  it("refuses members, roles, archive, restore and delete with 404", async () => {
    const { user } = await createWorkspaceMember();
    const demoId = (await startTourAs(user)).demoWorkspace.id;
    await enableAuditWebhook();

    mockAuthenticatedSession(await createInstanceAdmin());
    for (const [method, path] of [
      ["GET", `/admin/workspaces/${demoId}/members`],
      ["GET", `/admin/workspaces/${demoId}/roles`],
      ["POST", `/admin/workspaces/${demoId}/archive`],
      ["POST", `/admin/workspaces/${demoId}/restore`],
      ["DELETE", `/admin/workspaces/${demoId}`],
    ] as const)
      expect([method, path, (await send(method, path)).status]).toEqual([
        method,
        path,
        404,
      ]);

    const [demo] = await db
      .select()
      .from(schema.workspaceTable)
      .where(eq(schema.workspaceTable.id, demoId));
    expect(demo).toMatchObject({ archivedAt: null });
    expect(await deliveries()).toEqual([]);
  });

  it("still archives a team workspace and sends its audit webhook", async () => {
    const { workspace } = await createWorkspaceMember();
    await enableAuditWebhook();
    mockAuthenticatedSession(await createInstanceAdmin());

    const archived = await send(
      "POST",
      `/admin/workspaces/${workspace.id}/archive`,
    );
    expect(archived.status).toBe(200);
    expect(await deliveries()).toHaveLength(1);
  });

  it("keeps an admin's own demo deletion in the audit log and off every webhook", async () => {
    const admin = await createInstanceAdmin();
    const demoId = (await startTourAs(admin)).demoWorkspace.id;
    await enableAuditWebhook();

    await deleteNativeWorkspace(demoId, admin.id, {
      ipAddress: null,
      userAgent: null,
    });

    const audit = await db
      .select({ action: schema.adminAuditLogTable.action })
      .from(schema.adminAuditLogTable)
      .where(eq(schema.adminAuditLogTable.targetId, demoId));
    expect(audit).toEqual([{ action: "workspace.deleted" }]);
    expect(await deliveries()).toEqual([]);
  });
});

describe("ticket lookup", () => {
  it("never resolves someone else's demo task for an administrator", async () => {
    const { user } = await createWorkspaceMember();
    const demoId = (await startTourAs(user)).demoWorkspace.id;
    const admin = await createInstanceAdmin();

    mockAuthenticatedSession(admin);
    const response = await call(`/task/by-ticket-id/T-1?workspaceId=${demoId}`);
    expect(response.status).toBe(404);

    // A scoped key or MCP token resolves through the same grants.
    await expect(
      getTaskByTicketId(
        "T-1",
        admin.id,
        { workspaceId: demoId },
        {
          task: ["read"],
        },
      ),
    ).rejects.toMatchObject({ status: 404 });
  });

  it("does not let demos make an administrator's lookup ambiguous", async () => {
    const { user } = await createWorkspaceMember();
    await startTourAs(user);
    const admin = await createInstanceAdmin();
    await startTourAs(admin);

    const { workspace } = await createWorkspaceMember();
    const { project } = await createProjectFixture({
      workspaceId: workspace.id,
      slug: "T",
    });
    const [task] = await db
      .insert(schema.taskTable)
      .values({ projectId: project.id, title: "Team T-1", number: 1 })
      .returning();

    mockAuthenticatedSession(admin);
    const response = await call("/task/by-ticket-id/T-1");
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ id: task!.id });
  });

  it("still finds the owner's own demo task through membership", async () => {
    const { user } = await createWorkspaceMember();
    const seeded = await startTourAs(user);
    const response = await call(
      `/task/by-ticket-id/T-1?workspaceId=${seeded.demoWorkspace.id}`,
    );
    expect(response.status).toBe(200);
  });
});

describe("lock order: user row first, then workspaces", () => {
  it("lets account deletion and an overlapping tour start finish without a deadlock", async () => {
    const { user } = await createWorkspaceMember({ role: "owner" });
    const seeded = await startTourAs(user);

    let tourStart: Promise<Response> | undefined;
    await db.transaction(async (tx) => {
      // Holds the user row, then the demo row.
      await deleteAccountData(user.id, tx);
      // Tour start now waits on the user row instead of taking it first.
      tourStart = send("POST", "/tour/start");
      await new Promise((resolve) => setTimeout(resolve, 300));
      await deleteUserSessions(tx, user.id, { exceptSessionId: null });
      await tx.delete(schema.userTable).where(eq(schema.userTable.id, user.id));
    });

    const response = await tourStart!;
    expect(response.status).toBe(404);
    expect(
      await db
        .select()
        .from(schema.workspaceTable)
        .where(eq(schema.workspaceTable.id, seeded.demoWorkspace.id)),
    ).toEqual([]);
  });
});

describe("integrations in a demo workspace", () => {
  async function demoWithIntegration() {
    const { user } = await createWorkspaceMember({ role: "owner" });
    const seeded = await startTourAs(user);
    const projectId = seeded.demoWorkspace.projectId;
    const [integration] = await db
      .insert(schema.integrationTable)
      .values({
        projectId,
        type: "github",
        isActive: true,
        config: JSON.stringify({
          repositoryOwner: "team",
          repositoryName: "repo",
          installationId: 1,
        }),
      })
      .returning();
    const [link] = await db
      .insert(schema.externalLinkTable)
      .values({
        taskId: seeded.tasks[0]!.id,
        integrationId: integration!.id,
        resourceType: "issue",
        externalId: "9",
        url: "https://git.example/team/repo/issues/9",
        metadata: JSON.stringify({ syncFilterPaused: true }),
      })
      .returning();
    return { user, seeded, projectId, integration: integration!, link: link! };
  }

  it("refuses connect, repository listing and import with DEMO_WORKSPACE", async () => {
    const { user } = await createWorkspaceMember({ role: "owner" });
    const { demoWorkspace } = await startTourAs(user);
    const projectId = demoWorkspace.projectId;

    for (const response of [
      await call(`/github-integration/repositories/${projectId}`),
      await send("POST", `/github-integration/project/${projectId}`, {
        repositoryOwner: "team",
        repositoryName: "repo",
      }),
      await send("POST", "/github-integration/import-issues", { projectId }),
    ]) {
      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({ code: "DEMO_WORKSPACE" });
    }
    expect(await db.select().from(schema.integrationTable)).toEqual([]);
    expect(github.octokit).not.toHaveBeenCalled();
  });

  it("refuses review and resume before any provider call", async () => {
    const { projectId, link } = await demoWithIntegration();
    const base = `/integration-sync/project/${projectId}/github/links/${link.id}`;

    const review = await call(`${base}/review`);
    expect(review.status).toBe(403);
    const resume = await send("POST", `${base}/resume`, {
      source: "baton",
      token: "a".repeat(64),
    });
    expect(resume.status).toBe(403);
    expect(await resume.json()).toMatchObject({ code: "DEMO_WORKSPACE" });
    expect(github.octokit).not.toHaveBeenCalled();
  });

  it("stops at the provider write boundary too", async () => {
    const { integration, link } = await demoWithIntegration();
    await expect(providerIssue(integration, link)).rejects.toThrow(
      "Integrations do not act in a demo workspace",
    );
    expect(github.octokit).not.toHaveBeenCalled();
  });
});

describe("role CRUD on a demo workspace", () => {
  const origin = "http://localhost:5173";
  function authPost(path: string, body: unknown, cookie: string) {
    return createApp().app.request(`/api/auth${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: origin,
        Cookie: cookie,
      },
      body: JSON.stringify(body),
    });
  }

  it("refuses create, update and delete role with DEMO_WORKSPACE", async () => {
    const signedUp = await authPost(
      "/sign-up/email",
      {
        name: "Owner",
        email: "roles@example.com",
        password: "a-long-password",
      },
      "",
    );
    expect(signedUp.status).toBe(200);
    const cookie = signedUp.headers
      .getSetCookie()
      .map((value) => value.split(";")[0])
      .join("; ");
    const started = await createApp().app.request("/api/tour/start", {
      method: "POST",
      headers: { Origin: origin, Cookie: cookie },
    });
    expect(started.status).toBe(200);
    const organizationId = ((await started.json()) as TourStart).demoWorkspace
      .id;

    const roles = () =>
      db
        .select()
        .from(schema.workspaceRoleTable)
        .where(eq(schema.workspaceRoleTable.workspaceId, organizationId));
    const before = await roles();

    for (const [path, body] of [
      [
        "/organization/create-role",
        { organizationId, role: "reviewer", permission: { task: ["read"] } },
      ],
      [
        "/organization/update-role",
        {
          organizationId,
          roleName: "member",
          data: { permission: { task: ["read"] } },
        },
      ],
      ["/organization/delete-role", { organizationId, roleName: "member" }],
    ] as const) {
      const response = await authPost(path, body, cookie);
      expect([path, response.status]).toEqual([path, 403]);
      expect(await response.json()).toMatchObject({ code: "DEMO_WORKSPACE" });
    }
    expect(await roles()).toEqual(before);
  });
});

describe("notifications follow the resource they point at", () => {
  async function notifyAbout(taskId: string) {
    const response = await send("POST", "/notification", {
      type: "task_comment",
      title: "Note",
      message: "Note",
      relatedEntityId: taskId,
      relatedEntityType: "task",
    });
    expect(response.status).toBe(200);
  }
  async function notificationsFor(ids: string[]) {
    return db
      .select({ id: schema.notificationTable.id })
      .from(schema.notificationTable)
      .where(
        and(
          eq(schema.notificationTable.resourceType, "task"),
          inArray(schema.notificationTable.resourceId, ids),
        ),
      );
  }

  it("leaves nothing behind for a demo task deleted before the tour ends", async () => {
    const { user } = await createWorkspaceMember({ role: "owner" });
    const seeded = await startTourAs(user);
    const taskId = seeded.tasks.find((t) => t.key === "mcp-hello")!.id;
    await notifyAbout(taskId);
    expect(await notificationsFor([taskId])).toHaveLength(1);

    expect((await send("DELETE", `/task/${taskId}`)).status).toBe(200);
    expect(await notificationsFor([taskId])).toEqual([]);

    await notifyAbout(seeded.tasks[0]!.id);
    expect(
      (await send("POST", "/tour/finish", { outcome: "skipped" })).status,
    ).toBe(200);
    expect(await notificationsFor(seeded.tasks.map((t) => t.id))).toEqual([]);
  });

  it("deletes a team task's notifications with the task", async () => {
    const { user, workspace } = await createWorkspaceMember({ role: "owner" });
    const { project } = await createProjectFixture({
      workspaceId: workspace.id,
    });
    const [task] = await db
      .insert(schema.taskTable)
      .values({
        projectId: project.id,
        title: "Team",
        userId: user.id,
        number: 1,
      })
      .returning();
    mockAuthenticatedSession(user);
    await notifyAbout(task!.id);

    expect((await send("DELETE", `/task/${task!.id}`)).status).toBe(200);
    expect(await notificationsFor([task!.id])).toEqual([]);
  });
});

describe("tour mutations need a browser session", () => {
  it("refuses an API key on start, finish and replay", async () => {
    const { user } = await createWorkspaceMember();
    const { key } = await auth.api.createApiKey({
      body: { userId: user.id, name: "Tour" },
    });
    for (const [path, body] of [
      ["/tour/start", undefined],
      ["/tour/finish", { outcome: "skipped" }],
      ["/tour/replay", undefined],
    ] as const) {
      const response = await send("POST", path, body, { "x-api-key": key });
      expect([path, response.status]).toEqual([path, 403]);
      expect(await response.json()).toMatchObject({ code: "SESSION_REQUIRED" });
    }
    expect(
      await db
        .select()
        .from(schema.workspaceTable)
        .where(eq(schema.workspaceTable.demoOwnerUserId, user.id)),
    ).toEqual([]);
  });
});
