import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import { auth } from "../../apps/api/src/identity/better-auth/auth";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { signUpWithSession } from "./helpers/auth-session";
import { resetTestDatabase } from "./helpers/database";

type App = ReturnType<typeof createApp>["app"];

beforeEach(resetTestDatabase);

function putZone(app: App, timeZone: unknown, headers: Record<string, string>) {
  return app.request("/api/user/time-zone", {
    method: "PUT",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify({ timeZone }),
  });
}

async function storedZone(userId: string) {
  const [row] = await db
    .select({ timeZone: schema.userTable.timeZone })
    .from(schema.userTable)
    .where(eq(schema.userTable.id, userId));
  return row?.timeZone;
}

async function person(app: App, name: string, role?: string) {
  return signUpWithSession(app, {
    email: `${randomUUID()}@example.com`,
    name,
    role,
  });
}

describe("PUT /api/user/time-zone", () => {
  it("stores the zone exactly as sent and returns it", async () => {
    const { app } = createApp();
    const me = await person(app, "Zone Owner");

    for (const zone of ["Asia/Kolkata", "Asia/Calcutta", "UTC"]) {
      const response = await putZone(app, zone, { cookie: me.cookies });
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ timeZone: zone });
      expect(await storedZone(me.userId)).toBe(zone);
    }
  });

  it.each([
    "IST",
    "EST",
    "PST",
    "GMT",
    "EST5EDT",
    "+05:30",
    "GMT+5",
    "utc",
    "asia/kolkata",
    "Mars/Phobos",
    "",
    "Asia/Kolkata ",
    `Asia/${"K".repeat(60)}`,
    null,
    123,
  ])("rejects %j with 400 and keeps the stored zone", async (value) => {
    const { app } = createApp();
    const me = await person(app, "Zone Owner");
    expect(
      (await putZone(app, "Asia/Kathmandu", { cookie: me.cookies })).status,
    ).toBe(200);

    const response = await putZone(app, value, { cookie: me.cookies });

    expect(response.status).toBe(400);
    expect(await storedZone(me.userId)).toBe("Asia/Kathmandu");
  });

  it("rejects an API key with 403", async () => {
    const { app } = createApp();
    const me = await person(app, "Key Owner");
    const { key } = await auth.api.createApiKey({
      body: { userId: me.userId, name: "Time zone test" },
    });

    const response = await putZone(app, "Asia/Kolkata", {
      Authorization: `Bearer ${key}`,
    });

    expect(response.status).toBe(403);
    expect(await storedZone(me.userId)).toBeNull();
  });

  it("rejects a request without a session with 401", async () => {
    const { app } = createApp();
    expect((await putZone(app, "Asia/Kolkata", {})).status).toBe(401);
  });
});

describe("who can read a time zone", () => {
  it("GET /api/user/me returns the caller's zone, never another user's", async () => {
    const { app } = createApp();
    const me = await person(app, "Me");
    const other = await person(app, "Other");
    await putZone(app, "Asia/Kathmandu", { cookie: other.cookies });

    const before = await app.request("/api/user/me", {
      headers: { cookie: me.cookies },
    });
    expect(await before.json()).toMatchObject({
      id: me.userId,
      timeZone: null,
    });

    await putZone(app, "Asia/Kolkata", { cookie: me.cookies });
    const after = await app.request("/api/user/me", {
      headers: { cookie: me.cookies },
    });
    expect(await after.json()).toMatchObject({
      id: me.userId,
      timeZone: "Asia/Kolkata",
    });
  });

  it("leaves the zone out of the session, the member list and the admin user list", async () => {
    const { app } = createApp();
    const admin = await person(app, "Admin", "admin");
    const member = await person(app, "Member");
    const workspaceId = `workspace-${randomUUID()}`;
    await db.insert(schema.workspaceTable).values({
      id: workspaceId,
      name: "Zones",
      slug: workspaceId,
      createdAt: new Date(),
    });
    await db.insert(schema.workspaceUserTable).values([
      {
        workspaceId,
        userId: admin.userId,
        role: "owner",
        joinedAt: new Date(),
      },
      {
        workspaceId,
        userId: member.userId,
        role: "member",
        joinedAt: new Date(),
      },
    ]);
    for (const who of [admin, member]) {
      await putZone(app, "Asia/Kathmandu", { cookie: who.cookies });
    }

    const surfaces = [
      "/api/auth/get-session",
      `/api/workspace/${workspaceId}/members`,
      "/api/admin/users",
    ];
    for (const path of surfaces) {
      const response = await app.request(path, {
        headers: { cookie: admin.cookies },
      });
      expect(response.status, path).toBe(200);
      const body = await response.text();
      // Each surface lists people, so a leaked field would be in this body.
      expect(body, path).toContain(admin.userId);
      expect(body, path).not.toMatch(/timeZone|time_zone|Kathmandu/);
    }
  });
});
