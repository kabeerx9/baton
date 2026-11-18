import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import updateUser from "../../apps/api/src/admin/controllers/update-user";
import { createApp } from "../../apps/api/src/index";
import { resetTestDatabase } from "./helpers/database";

// auth-boundary P4 A6: the instance role is Baton's. The admin plugin left;
// sign-up writes the role, the ban is checked at sign-in, and
// `/api/admin/users/{id}` is the only way to change a role.

type App = ReturnType<typeof createApp>["app"];
const PASSWORD = "admin-role-test-password";
let app: App;

function auth(path: string, body: unknown, headers: HeadersInit = {}) {
  return app.request(`/api/auth${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "http://localhost:5173",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

async function signUp(email = `${randomUUID()}@example.com`) {
  const response = await auth("/sign-up/email", {
    name: "Role test user",
    email,
    password: PASSWORD,
  });
  expect(response.status).toBe(200);
  const { user } = (await response.json()) as { user: { id: string } };
  return { id: user.id, email };
}

function signIn(email: string) {
  return auth("/sign-in/email", { email, password: PASSWORD });
}

async function createUser(role: string) {
  const { id, email } = await signUp();
  await db
    .update(schema.userTable)
    .set({ role })
    .where(eq(schema.userTable.id, id));
  const response = await signIn(email);
  expect(response.status).toBe(200);
  const { token } = (await response.json()) as { token: string };
  const cookie = response.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
  expect(cookie).toContain("better-auth.session");
  return { id, cookie, token };
}

function setRole(userId: string, role: string, headers: HeadersInit = {}) {
  return app.request(`/api/admin/users/${userId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify({ role }),
  });
}

async function getRole(id: string) {
  const [user] = await db
    .select({ role: schema.userTable.role })
    .from(schema.userTable)
    .where(eq(schema.userTable.id, id));
  return user!.role;
}

beforeEach(async () => {
  await resetTestDatabase();
  ({ app } = createApp());
});

describe("instance role at sign-up and sign-in", () => {
  it("makes the first user the admin and gives later ones the default role", async () => {
    const first = await signUp();
    const second = await signUp();
    expect(await getRole(first.id)).toBe("admin");
    expect(await getRole(second.id)).toBe("user");
  });

  it("gives a new user the instance's configured default role", async () => {
    await signUp();
    await db.insert(schema.instanceRoleTable).values({
      id: "role-reviewer",
      name: "reviewer",
      permissions: [],
    } as typeof schema.instanceRoleTable.$inferInsert);
    await db
      .insert(schema.instanceSettingsTable)
      .values({ id: "instance", defaultRoleId: "role-reviewer" } as never)
      .onConflictDoUpdate({
        target: schema.instanceSettingsTable.id,
        set: { defaultRoleId: "role-reviewer" },
      });
    const later = await signUp();
    expect(await getRole(later.id)).toBe("reviewer");
  });

  it("refuses sign-in for a deactivated user and lets them back once reactivated", async () => {
    await signUp();
    const user = await signUp();
    await db
      .update(schema.userTable)
      .set({ banned: true })
      .where(eq(schema.userTable.id, user.id));

    const sessionsOf = () =>
      db
        .select({ id: schema.sessionTable.id })
        .from(schema.sessionTable)
        .where(eq(schema.sessionTable.userId, user.id));
    const before = await sessionsOf();

    const refused = await signIn(user.email);
    expect(refused.status).toBe(403);
    expect(await refused.json()).toMatchObject({ code: "BANNED_USER" });
    expect(refused.headers.getSetCookie()).toEqual([]);
    expect(await sessionsOf()).toEqual(before);

    // An expired ban no longer counts.
    await db
      .update(schema.userTable)
      .set({ banExpires: new Date(Date.now() - 1000) })
      .where(eq(schema.userTable.id, user.id));
    expect((await signIn(user.email)).status).toBe(200);
  });
});

describe("PATCH /api/admin/users/{id} role", () => {
  it.each(["user", "admin"])(
    "rejects setting your own role to %s",
    async (role) => {
      const admin = await createUser("admin");
      const response = await setRole(admin.id, role, { Cookie: admin.cookie });

      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({
        code: "YOU_CANNOT_CHANGE_YOUR_OWN_ROLE",
      });
      expect(await getRole(admin.id)).toBe("admin");
    },
  );

  it("rejects changing your own role using a bearer token", async () => {
    const admin = await createUser("admin");
    const response = await setRole(admin.id, "user", {
      Authorization: `Bearer ${admin.token}`,
    });

    expect(response.status).toBe(400);
    expect(await getRole(admin.id)).toBe("admin");
  });

  it("keeps the last admin when two admins demote each other at once", async () => {
    const first = await createUser("admin");
    const second = await createUser("user,admin");
    const audit = { actorUserId: null, ipAddress: null, userAgent: null };

    // Both requests have already passed authorization before either write.
    const results = await Promise.allSettled([
      updateUser(
        { userId: second.id, actorId: first.id, role: "user" },
        {
          ...audit,
          actorUserId: first.id,
        },
      ),
      updateUser(
        { userId: first.id, actorId: second.id, role: "user" },
        {
          ...audit,
          actorUserId: second.id,
        },
      ),
    ]);

    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      results.find((result) => result.status === "rejected"),
    ).toMatchObject({
      reason: { status: 400, code: "CANNOT_REMOVE_LAST_ADMIN" },
    });
    const roles = await Promise.all([getRole(first.id), getRole(second.id)]);
    expect(
      roles.filter((role) => role?.split(",").includes("admin")),
    ).toHaveLength(1);
  });

  it("counts an admin stored as a role list as remaining", async () => {
    const admin = await createUser("admin");
    const listed = await createUser("user,admin");
    const headers = { Cookie: admin.cookie };

    expect((await setRole(listed.id, "user", headers)).status).toBe(200);
    expect(await getRole(listed.id)).toBe("user");
  });

  it("denies a demoted admin even with their old session cookie", async () => {
    const admin = await createUser("admin");
    const other = await createUser("admin");
    expect(
      (await setRole(other.id, "user", { Cookie: admin.cookie })).status,
    ).toBe(200);

    const response = await setRole(admin.id, "user", { Cookie: other.cookie });
    expect(response.status).toBe(403);
    expect(await getRole(admin.id)).toBe("admin");
  });

  it("requires authentication", async () => {
    const admin = await createUser("admin");
    const response = await setRole(admin.id, "user");
    expect(response.status).toBe(401);
    expect(await getRole(admin.id)).toBe("admin");
  });

  it("answers 404 on the provider's removed role routes", async () => {
    const admin = await createUser("admin");
    const other = await createUser("user");
    for (const [path, body] of [
      ["/admin/set-role", { userId: other.id, role: "admin" }],
      ["/admin/update-user", { userId: other.id, data: { role: "admin" } }],
    ] as const) {
      const response = await auth(path, body, { Cookie: admin.cookie });
      expect(response.status, path).toBe(404);
    }
    expect(await getRole(other.id)).toBe("user");
  });
});
