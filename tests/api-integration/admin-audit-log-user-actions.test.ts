import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { serve } from "@hono/node-server";
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
import { createApp } from "../../apps/api/src/index";
import { readAuditLog } from "./helpers/admin/read-audit-log";
import { signUpWithSession } from "./helpers/auth-session";
import { resetTestDatabase } from "./helpers/database";
import { createTestApiKey } from "./helpers/api-key";

type App = ReturnType<typeof createApp>["app"];

let app: App;
let admin: { userId: string; cookies: string };
let target: { userId: string; cookies: string };

function call(
  method: string,
  path: string,
  body: unknown,
  headers: Record<string, string>,
) {
  return app.request(`/api/admin${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      origin: "http://localhost:5173",
      "user-agent": "audit-test-agent",
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

const asAdmin = (method: string, path: string, body?: unknown) =>
  call(method, path, body, { cookie: admin.cookies });

async function expectOk(response: Response) {
  expect(response.status, await response.clone().text()).toBeLessThan(300);
}

beforeEach(async () => {
  await resetTestDatabase();
  ({ app } = createApp());
  admin = await signUpWithSession(app, {
    email: "admin@example.com",
    name: "Ada Admin",
    role: "admin",
  });
  target = await signUpWithSession(app, {
    email: "target@example.com",
    name: "Tom Target",
    role: "user",
  });
});

afterEach(() => vi.unstubAllEnvs());

// The admin plugin's routes left with it (auth-boundary P4); every admin
// change is a Baton route that writes its audit row in its own transaction.
describe("audit of admin user actions", () => {
  it("records role changes separately from other profile updates", async () => {
    await expectOk(
      await asAdmin("PATCH", `/users/${target.userId}`, {
        name: "Tim Target",
        email: "tim@example.com",
        role: "admin",
      }),
    );

    const rows = await readAuditLog();
    expect(rows.map((row) => row.action).sort()).toEqual([
      "user.role_changed",
      "user.updated",
    ]);
    expect(
      rows.find((row) => row.action === "user.role_changed"),
    ).toMatchObject({
      actorUserId: admin.userId,
      actorName: "Ada Admin",
      actorEmail: "admin@example.com",
      targetType: "user",
      targetId: target.userId,
      metadata: { from: "user", to: "admin" },
      userAgent: "audit-test-agent",
    });
    expect(rows.find((row) => row.action === "user.updated")).toMatchObject({
      targetId: target.userId,
    });
  });

  it("records nothing when an update changes nothing", async () => {
    await expectOk(
      await asAdmin("PATCH", `/users/${target.userId}`, {
        name: "Tom Target",
        email: "target@example.com",
        role: "user",
      }),
    );

    expect(await readAuditLog()).toEqual([]);
  });

  it("records a role change, deactivation, and reactivation", async () => {
    await expectOk(
      await asAdmin("PATCH", `/users/${target.userId}`, { role: "admin" }),
    );
    await expectOk(await asAdmin("POST", `/users/${target.userId}/deactivate`));
    await expectOk(await asAdmin("POST", `/users/${target.userId}/reactivate`));

    const rows = await readAuditLog();
    expect(rows.map((row) => row.action).sort()).toEqual([
      "user.deactivated",
      "user.reactivated",
      "user.role_changed",
    ]);
    expect(rows.every((row) => row.targetId === target.userId)).toBe(true);
  });

  it("records administrators who authenticate with a bearer token", async () => {
    const token = decodeURIComponent(
      admin.cookies.match(/session_token=([^;]+)/)?.[1] ?? "",
    );
    expect(token).not.toBe("");

    await expectOk(
      await call(
        "PATCH",
        `/users/${target.userId}`,
        { role: "admin" },
        // The bearer token decides the session even next to another cookie.
        { authorization: `Bearer ${token}`, cookie: target.cookies },
      ),
    );

    const [row] = await readAuditLog();
    expect(row).toMatchObject({
      action: "user.role_changed",
      actorUserId: admin.userId,
      targetId: target.userId,
    });
  });

  it("keeps the label of a deleted user", async () => {
    await expectOk(await asAdmin("DELETE", `/users/${target.userId}`));

    const [row] = await readAuditLog();
    expect(row).toMatchObject({
      action: "user.deleted",
      targetId: target.userId,
      targetLabel: "target@example.com",
      metadata: { name: "Tom Target" },
    });
  });

  it("never stores session tokens", async () => {
    const created = await asAdmin("POST", "/users", {
      email: "new@example.com",
      name: "New Person",
      role: "user",
    });
    await expectOk(created);
    const { user: createdUser } = (await created.json()) as {
      user: { id: string };
    };
    const [session] = await db
      .select()
      .from(schema.sessionTable)
      .where(eq(schema.sessionTable.userId, target.userId));
    await expectOk(
      await asAdmin(
        "DELETE",
        `/users/${target.userId}/sessions/${session!.id}`,
      ),
    );
    await expectOk(await asAdmin("DELETE", `/users/${target.userId}/sessions`));

    const rows = await readAuditLog();
    expect(rows.map((row) => row.action).sort()).toEqual([
      "session.revoked",
      "session.revoked_all",
      "user.created",
    ]);
    expect(rows.find((row) => row.action === "user.created")).toMatchObject({
      targetId: createdUser.id,
      targetLabel: "new@example.com",
    });
    const stored = JSON.stringify(rows);
    expect(stored).not.toContain(session!.token);
    expect(stored).not.toMatch(/password"|token"/i);
  });

  it("records nothing for forbidden or failed admin calls", async () => {
    const asTarget = (method: string, path: string, body?: unknown) =>
      call(method, path, body, { cookie: target.cookies });

    expect(
      (await asTarget("POST", `/users/${admin.userId}/deactivate`)).status,
    ).toBe(403);
    expect(
      (await asTarget("PATCH", `/users/${admin.userId}`, { role: "user" }))
        .status,
    ).toBe(403);
    expect((await asTarget("DELETE", `/users/${admin.userId}`)).status).toBe(
      403,
    );
    expect(
      (await asAdmin("POST", `/users/${admin.userId}/deactivate`)).status,
    ).toBe(400);
    expect(
      (await asAdmin("PATCH", `/users/${admin.userId}`, { role: "user" }))
        .status,
    ).toBe(400);
    expect(
      (await asAdmin("POST", "/users/missing-user/reactivate")).status,
    ).toBe(404);
    expect(
      (await call("POST", `/users/${target.userId}/deactivate`, undefined, {}))
        .status,
    ).toBe(401);

    const { key } = await createTestApiKey({
      userId: admin.userId,
      name: "Audit test",
    });
    expect(
      (
        await call("POST", `/users/${target.userId}/deactivate`, undefined, {
          "x-api-key": key,
        })
      ).status,
    ).toBe(403);

    expect(await readAuditLog()).toEqual([]);
  });

  it("answers the removed provider admin routes with 404 and records nothing", async () => {
    for (const path of [
      "ban-user",
      "unban-user",
      "set-role",
      "update-user",
      "create-user",
      "remove-user",
      "set-user-password",
      "impersonate-user",
      "list-users",
      "revoke-user-sessions",
    ]) {
      const response = await app.request(`/api/auth/admin/${path}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:5173",
          cookie: admin.cookies,
        },
        body: JSON.stringify({ userId: target.userId, role: "admin" }),
      });
      expect(response.status, path).toBe(404);
    }
    expect(await readAuditLog()).toEqual([]);
    expect(
      await db.query.userTable.findFirst({
        where: eq(schema.userTable.id, target.userId),
      }),
    ).toMatchObject({ role: "user", banned: false });
  });

  it("keeps the actor snapshot after the administrator is deleted", async () => {
    await expectOk(
      await asAdmin("PATCH", `/users/${target.userId}`, { role: "admin" }),
    );
    await db
      .delete(schema.userTable)
      .where(eq(schema.userTable.id, admin.userId));

    const [row] = await readAuditLog();
    expect(row).toMatchObject({
      actorUserId: null,
      actorName: "Ada Admin",
      actorEmail: "admin@example.com",
    });
  });

  it("records the client address resolved from the transport", async () => {
    vi.stubEnv("TRUSTED_PROXIES", "127.0.0.0/8");
    ({ app } = createApp());
    const server = serve({ fetch: app.fetch, hostname: "127.0.0.1", port: 0 });
    await once(server, "listening");
    try {
      const { port } = server.address() as AddressInfo;
      const response = await fetch(
        `http://127.0.0.1:${port}/api/admin/users/${target.userId}/deactivate`,
        {
          method: "POST",
          headers: {
            origin: "http://localhost:5173",
            cookie: admin.cookies,
            "x-baton-client-ip": "1.2.3.4",
            "x-forwarded-for": "203.0.113.9",
          },
        },
      );
      expect(response.status, await response.text()).toBe(200);
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }

    const [row] = await readAuditLog();
    expect(row.ipAddress).toBe("203.0.113.9");
  });
});
