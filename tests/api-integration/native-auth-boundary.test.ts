import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { signUpWithSession } from "./helpers/auth-session";
import { resetTestDatabase } from "./helpers/database";
import { createProjectFixture } from "./helpers/fixtures";

type Permissions = Record<string, string[]>;
type App = ReturnType<typeof createApp>["app"];

// Notification delivery is covered separately. Keep its background handlers
// from racing the database resets in this native authorization suite.
vi.mock("../../apps/api/src/events", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../apps/api/src/events")>()),
  publishEvent: vi.fn().mockResolvedValue(undefined),
}));

beforeEach(resetTestDatabase);

async function fixture() {
  const { app } = createApp();
  const owner = await signUpWithSession(app, {
    email: "owner@example.com",
    name: "Owner",
    role: "user",
  });
  const viewer = await signUpWithSession(app, {
    email: "viewer@example.com",
    name: "Viewer",
    role: "user",
  });
  const [workspace] = await db
    .insert(schema.workspaceTable)
    .values({
      name: "Private workspace",
      slug: randomUUID(),
      createdAt: new Date(),
    })
    .returning();
  await db.insert(schema.workspaceUserTable).values([
    {
      workspaceId: workspace.id,
      userId: owner.userId,
      role: "owner",
      joinedAt: new Date(),
    },
    {
      workspaceId: workspace.id,
      userId: viewer.userId,
      role: "limited",
      joinedAt: new Date(),
    },
  ]);
  await db.insert(schema.workspaceRoleTable).values({
    workspaceId: workspace.id,
    role: "limited",
    permission: "{}",
  });
  const sessions = await db.select().from(schema.sessionTable);
  const ownerToken = sessions.find(
    (session) => session.userId === owner.userId,
  )!.token;
  const viewerToken = sessions.find(
    (session) => session.userId === viewer.userId,
  )!.token;
  return { app, owner, viewer, workspace, ownerToken, viewerToken };
}

async function keyFor(
  app: App,
  cookies: string,
  permissions: Permissions | null,
) {
  const response = await app.request("/api/api-key", {
    method: "POST",
    headers: { cookie: cookies, "content-type": "application/json" },
    body: JSON.stringify({ name: "Boundary regression" }),
  });
  expect(response.status).toBe(201);
  const key = (await response.json()) as { id: string; key: string };
  // Permissions are server-only: no client sets them. Narrow the actual key
  // after normal credential creation rather than mocking provider validation.
  await db
    .update(schema.apikeyTable)
    .set({
      rateLimitEnabled: false,
      ...(permissions !== null
        ? { permissions: JSON.stringify(permissions) }
        : {}),
    })
    .where(eq(schema.apikeyTable.id, key.id));
  return key;
}

function keyHeaders(key: string, bearer: boolean, cookies?: string) {
  return {
    ...(bearer ? { authorization: `bEaReR ${key}` } : { "x-api-key": key }),
    ...(cookies ? { cookie: cookies } : {}),
    "content-type": "application/json",
  };
}

describe("native auth credential boundary", () => {
  it.each([null, { label: ["read"] }] as (Permissions | null)[])(
    "keeps scoped and legacy keys out of account, session and admin management (%j)",
    async (permissions) => {
      const { app, owner, viewer, ownerToken } = await fixture();
      await db
        .update(schema.userTable)
        .set({ role: "admin" })
        .where(eq(schema.userTable.id, owner.userId));
      const key = await keyFor(app, owner.cookies, permissions);
      const sessionIds = (await db.select().from(schema.sessionTable))
        .map((row) => row.id)
        .sort();
      const keyIds = (await db.select().from(schema.apikeyTable))
        .map((row) => row.id)
        .sort();
      const operations = [
        { path: "/api-key/create", body: { name: "Escaped" } },
        { path: "/api-key/list", method: "GET" },
        { path: `/api-key/get?id=${key.id}`, method: "GET" },
        { path: "/api-key/update", body: { keyId: key.id, name: "Changed" } },
        { path: "/api-key/delete", body: { keyId: key.id } },
        { path: "/get-session", method: "GET" },
        { path: "/list-sessions", method: "GET" },
        { path: "/revoke-session", body: { token: ownerToken } },
        { path: "/revoke-sessions", body: {} },
        { path: "/revoke-other-sessions", body: {} },
        { path: "/update-user", body: { name: "Changed" } },
        { path: "/change-email", body: { newEmail: "changed@example.com" } },
        {
          path: "/change-password",
          body: {
            currentPassword: "correct horse battery staple",
            newPassword: "another long password",
          },
        },
        { path: "/get-access-token", body: { providerId: "github" } },
        { path: "/admin/impersonate-user", body: { userId: viewer.userId } },
        {
          path: "/admin/create-user",
          body: {
            email: "created@example.com",
            name: "Created",
            password: "another long password",
          },
        },
        { path: "/admin/remove-user", body: { userId: viewer.userId } },
      ];
      for (const bearer of [false, true]) {
        for (const cookies of [undefined, owner.cookies]) {
          for (const operation of operations) {
            const response = await app.request(`/api/auth${operation.path}`, {
              method: operation.method ?? "POST",
              headers: keyHeaders(key.key, bearer, cookies),
              ...(operation.body
                ? { body: JSON.stringify(operation.body) }
                : {}),
            });
            expect(
              response.status,
              `${operation.path}, bearer=${bearer}, cookie=${Boolean(cookies)}`,
            ).toBe(403);
            expect(await response.json()).toMatchObject({
              code: "SESSION_REQUIRED",
            });
          }
        }
      }
      expect(
        (await db.select().from(schema.sessionTable))
          .map((row) => row.id)
          .sort(),
      ).toEqual(sessionIds);
      expect(
        (await db.select().from(schema.apikeyTable))
          .map((row) => row.id)
          .sort(),
      ).toEqual(keyIds);
      expect(
        await db.query.userTable.findFirst({
          where: eq(schema.userTable.id, owner.userId),
        }),
      ).toMatchObject({ name: "Owner" });
      expect(
        await db.query.userTable.findFirst({
          where: eq(schema.userTable.id, viewer.userId),
        }),
      ).toBeDefined();
    },
  );

  it.each([null, { label: ["read"] }] as (Permissions | null)[])(
    "refuses a key on get-session even beside a valid cookie, spending no quota (%j)",
    async (permissions) => {
      const { app, owner, viewer } = await fixture();
      const key = await keyFor(app, owner.cookies, permissions);
      await db
        .update(schema.apikeyTable)
        .set({ rateLimitEnabled: true, rateLimitMax: 1 })
        .where(eq(schema.apikeyTable.id, key.id));
      for (const bearer of [false, true]) {
        const response = await app.request("/api/auth/get-session", {
          headers: keyHeaders(key.key, bearer, viewer.cookies),
        });
        expect(response.status).toBe(403);
        expect(response.headers.get("cache-control")).toBe("no-store");
        expect(await response.json()).toMatchObject({
          code: "SESSION_REQUIRED",
        });
      }
      const [row] = await db
        .select({ requestCount: schema.apikeyTable.requestCount })
        .from(schema.apikeyTable)
        .where(eq(schema.apikeyTable.id, key.id));
      expect(row?.requestCount).toBe(0);
      // The key's one request is still there for REST.
      const me = await app.request("/api/user/me", {
        headers: { "x-api-key": key.key },
      });
      expect(me.status).toBe(200);
    },
  );

  it("checks the named workspace and the key owner's current role", async () => {
    const { app, owner, viewer, workspace, viewerToken } = await fixture();
    const [readable] = await db
      .insert(schema.workspaceTable)
      .values({
        name: "Readable",
        slug: randomUUID(),
        createdAt: new Date(),
      })
      .returning();
    await db.insert(schema.workspaceUserTable).values({
      workspaceId: readable.id,
      userId: viewer.userId,
      role: "owner",
      joinedAt: new Date(),
    });
    // A readable workspace elsewhere does not open the limited one.
    const bearer = { authorization: `Bearer ${viewerToken}` };
    expect(
      (await app.request(`/api/workspace/${workspace.id}`, { headers: bearer }))
        .status,
    ).toBe(404);
    expect(
      (
        await app.request(`/api/workspace/${workspace.id}/members`, {
          headers: bearer,
        })
      ).status,
    ).toBe(403);
    expect(
      (await app.request(`/api/workspace/${readable.id}`, { headers: bearer }))
        .status,
    ).toBe(200);
    // A key acts as its owner, never as the cookie sent beside it.
    for (const permissions of [
      null,
      { workspace: ["read"] },
    ] as (Permissions | null)[]) {
      const key = await keyFor(app, viewer.cookies, permissions);
      const response = await app.request(`/api/workspace/${workspace.id}`, {
        headers: keyHeaders(key.key, true, owner.cookies),
      });
      expect(response.status).toBe(404);
    }
  });

  it("answers the removed provider organization endpoints with 404", async () => {
    const { app, owner, workspace } = await fixture();
    const key = await keyFor(app, owner.cookies, null);
    for (const headers of [
      { cookie: owner.cookies },
      keyHeaders(key.key, true),
    ]) {
      for (const [method, path] of [
        ["GET", "list"],
        ["GET", `get-full-organization?organizationId=${workspace.id}`],
        ["GET", `list-members?organizationId=${workspace.id}`],
        ["GET", "get-active-member"],
        ["POST", "create"],
        ["POST", "update"],
        ["POST", "set-active"],
      ] as const) {
        const response = await app.request(`/api/auth/organization/${path}`, {
          method,
          headers: { ...headers, "content-type": "application/json" },
          ...(method === "POST"
            ? {
                body: JSON.stringify({
                  organizationId: workspace.id,
                  name: "Escaped",
                  slug: "escaped",
                  data: { name: "Escaped" },
                }),
              }
            : {}),
        });
        expect(response.status, path).toBe(404);
      }
    }
    const [row] = await db
      .select()
      .from(schema.workspaceTable)
      .where(eq(schema.workspaceTable.id, workspace.id));
    expect(row?.name).toBe("Private workspace");
    expect(await db.select().from(schema.workspaceTable)).toHaveLength(1);
  });

  it("keeps real bearer and cookie credential management; impersonation is gone", async () => {
    const { app, owner, viewer, ownerToken } = await fixture();
    await db
      .update(schema.userTable)
      .set({ role: "admin" })
      .where(eq(schema.userTable.id, owner.userId));
    for (const headers of [
      { cookie: owner.cookies },
      { authorization: `bEaReR ${ownerToken}` },
    ]) {
      const created = await app.request("/api/api-key", {
        method: "POST",
        headers: { ...headers, "content-type": "application/json" },
        body: JSON.stringify({ name: "Real session" }),
      });
      expect(created.status).toBe(201);
      const sessions = await app.request("/api/auth/list-sessions", {
        headers,
      });
      expect(sessions.status).toBe(200);
      const impersonation = await app.request(
        "/api/auth/admin/impersonate-user",
        {
          method: "POST",
          headers: { ...headers, "content-type": "application/json" },
          body: JSON.stringify({ userId: viewer.userId }),
        },
      );
      expect(impersonation.status).toBe(404);
    }
  });
});

describe("workspace scope and current workspace grants", () => {
  it("batches list grants by current workspace roles and keeps admins to their memberships", async () => {
    const { app, viewer, workspace } = await fixture();
    await db
      .update(schema.userTable)
      .set({ role: "admin" })
      .where(eq(schema.userTable.id, viewer.userId));
    const [fallback, multi, demoted] = await db
      .insert(schema.workspaceTable)
      .values(
        ["Fallback", "Multi", "Demoted", "Nonmember"].map((name) => ({
          name,
          slug: randomUUID(),
          createdAt: new Date(),
        })),
      )
      .returning();
    await db.insert(schema.workspaceUserTable).values([
      {
        workspaceId: fallback.id,
        userId: viewer.userId,
        role: "member",
        joinedAt: new Date(),
      },
      {
        workspaceId: multi.id,
        userId: viewer.userId,
        role: "limited,reader",
        joinedAt: new Date(),
      },
      {
        workspaceId: demoted.id,
        userId: viewer.userId,
        role: "admin",
        joinedAt: new Date(),
      },
    ]);
    await db.insert(schema.workspaceRoleTable).values([
      { workspaceId: multi.id, role: "limited", permission: "{}" },
      {
        workspaceId: multi.id,
        role: "reader",
        permission: JSON.stringify({ workspace: ["read"] }),
      },
      { workspaceId: demoted.id, role: "admin", permission: "{}" },
    ]);
    const list = async () => {
      const response = await app.request("/api/workspace", {
        headers: { cookie: viewer.cookies },
      });
      expect(response.status).toBe(200);
      return ((await response.json()) as { id: string }[])
        .map((row) => row.id)
        .sort();
    };
    // An instance admin lists every membership (the list route says so),
    // and never a workspace without one.
    expect(await list()).toEqual(
      [fallback.id, multi.id, demoted.id, workspace.id].sort(),
    );
    // A plain user lists only memberships whose current roles grant read.
    await db
      .update(schema.userTable)
      .set({ role: "user" })
      .where(eq(schema.userTable.id, viewer.userId));
    expect(await list()).toEqual([fallback.id, multi.id].sort());
    await db
      .update(schema.workspaceRoleTable)
      .set({ permission: "{}" })
      .where(eq(schema.workspaceRoleTable.workspaceId, multi.id));
    expect(await list()).toEqual([fallback.id]);
  });

  it.each([false, true])(
    "denies limited roles through the workspace routes (bearer=%s)",
    async (bearer) => {
      const { app, viewer, viewerToken, workspace } = await fixture();
      const headers = bearer
        ? { authorization: `Bearer ${viewerToken}` }
        : { cookie: viewer.cookies };
      expect(
        (await app.request(`/api/workspace/${workspace.id}`, { headers }))
          .status,
      ).toBe(404);
      expect(
        (
          await app.request(`/api/workspace/${workspace.id}/members`, {
            headers,
          })
        ).status,
      ).toBe(403);
      const list = await app.request("/api/workspace", { headers });
      expect(list.status).toBe(200);
      expect(await list.json()).toEqual([]);
      for (const suffix of ["capabilities", "project-access/me"]) {
        const discovery = await app.request(
          `/api/workspace/${workspace.id}/${suffix}`,
          { headers },
        );
        expect(discovery.status).toBe(200);
      }
      await db
        .update(schema.workspaceRoleTable)
        .set({ permission: JSON.stringify({ workspace: ["read"] }) })
        .where(eq(schema.workspaceRoleTable.workspaceId, workspace.id));
      const allowed = await app.request(`/api/workspace/${workspace.id}`, {
        headers,
      });
      expect(allowed.status).toBe(200);
      expect(await allowed.json()).toMatchObject({ id: workspace.id });
    },
  );

  it.each([false, true])(
    "enforces workspace key scopes with a valid cookie present (bearer=%s)",
    async (bearer) => {
      const { app, owner, viewer, workspace } = await fixture();
      const limited = await keyFor(app, owner.cookies, { label: ["read"] });
      const reader = await keyFor(app, owner.cookies, { workspace: ["read"] });
      const legacy = await keyFor(app, owner.cookies, null);
      for (const cookies of [undefined, viewer.cookies]) {
        for (const path of [
          `/api/workspace/${workspace.id}`,
          `/api/workspace/${workspace.id}/members`,
          "/api/workspace",
        ]) {
          const response = await app.request(path, {
            headers: keyHeaders(limited.key, bearer, cookies),
          });
          expect(response.status, path).toBe(403);
          expect(await response.json()).toMatchObject({
            code: "API_KEY_SCOPE",
          });
        }
        for (const key of [reader, legacy]) {
          const full = await app.request(`/api/workspace/${workspace.id}`, {
            headers: keyHeaders(key.key, bearer, cookies),
          });
          expect(full.status).toBe(200);
          expect(await full.json()).toMatchObject({
            id: workspace.id,
            role: "owner",
          });
        }
      }
      const { project } = await createProjectFixture({
        workspaceId: workspace.id,
      });
      const [task] = await db
        .insert(schema.taskTable)
        .values({
          projectId: project.id,
          title: "Key task",
          number: 1,
          status: "to-do",
        })
        .returning();
      const taskKey = await keyFor(app, owner.cookies, { task: ["read"] });
      expect(
        (
          await app.request(`/api/task/${task.id}`, {
            headers: keyHeaders(taskKey.key, bearer),
          })
        ).status,
      ).toBe(200);
      expect(
        (
          await app.request(`/api/task/${task.id}`, {
            headers: keyHeaders(limited.key, bearer, owner.cookies),
          })
        ).status,
      ).toBe(403);
    },
  );

  it("requires mutation scopes and keeps CLI workspace operations", async () => {
    const { app, owner, viewer, workspace } = await fixture();
    const limited = await keyFor(app, owner.cookies, { label: ["read"] });
    const editor = await keyFor(app, owner.cookies, {
      organization: ["update"],
    });
    const operations = [
      {
        method: "PATCH",
        path: `/api/workspace/${workspace.id}`,
        body: { name: "Updated" },
      },
      {
        method: "PUT",
        path: `/api/workspace/${workspace.id}/members/${viewer.userId}/role`,
        body: { role: "admin" },
      },
      { method: "POST", path: "/api/workspace", body: { name: "Escaped" } },
    ] as const;
    for (const operation of operations) {
      const response = await app.request(operation.path, {
        method: operation.method,
        headers: keyHeaders(limited.key, false, owner.cookies),
        body: JSON.stringify(operation.body),
      });
      expect(response.status, operation.path).toBe(403);
      expect(await response.json()).toMatchObject({ code: "API_KEY_SCOPE" });
    }
    const updated = await app.request(operations[0].path, {
      method: "PATCH",
      headers: keyHeaders(editor.key, true, owner.cookies),
      body: JSON.stringify(operations[0].body),
    });
    expect(updated.status).toBe(200);
    expect(await updated.json()).toMatchObject({ name: "Updated" });
    const legacy = await keyFor(app, owner.cookies, null);
    const created = await app.request("/api/workspace", {
      method: "POST",
      headers: keyHeaders(legacy.key, false),
      body: JSON.stringify({ name: "CLI workspace" }),
    });
    expect(created.status).toBe(201);
    expect(await created.json()).toMatchObject({
      name: "CLI workspace",
      role: "owner",
    });
  });
});
