import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { adminUsersApi } from "./helpers/admin/admin-users-api";
import { signUpWithSession } from "./helpers/auth-session";
import { avatarState, PNG_UPLOAD } from "./helpers/avatar/avatar-state";
import { resetTestDatabase } from "./helpers/database";

type App = ReturnType<typeof createApp>["app"];

let app: App;
let me: { userId: string; cookies: string };
let myUrl: string;

const authPost = (path: string, body: unknown, cookies = me.cookies) =>
  app.request(`/api/auth${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "http://localhost:5173",
      cookie: cookies,
    },
    body: JSON.stringify(body),
  });

async function uploadUrl(cookies: string) {
  const response = await app.request("/api/user/avatar", {
    method: "PUT",
    headers: { "content-type": "application/json", cookie: cookies },
    body: JSON.stringify(PNG_UPLOAD),
  });
  expect(response.status).toBe(200);
  return ((await response.json()) as { url: string }).url;
}

async function storedUser(userId: string) {
  const [user] = await db
    .select({ name: schema.userTable.name, image: schema.userTable.image })
    .from(schema.userTable)
    .where(eq(schema.userTable.id, userId));
  return user;
}

beforeEach(async () => {
  await resetTestDatabase();
  ({ app } = createApp());
  me = await signUpWithSession(app, { email: "me@example.com", name: "Me" });
  myUrl = await uploadUrl(me.cookies);
});

describe("Better Auth never writes user.image", () => {
  it.each([
    ["an image-only update (old bundles)", null],
    ["an external URL", "https://tracker.example/pixel.png"],
    ["a nonexistent avatar id", "/api/user/avatar/nonexistent"],
  ])("ignores %s on /update-user", async (_label, image) => {
    const response = await authPost("/update-user", { image });
    expect(response.status, await response.clone().text()).toBe(200);
    expect(await avatarState(me.userId)).toMatchObject({ image: myUrl });
  });

  it("ignores another user's avatar URL", async () => {
    const other = await signUpWithSession(app, {
      email: "other@example.com",
      name: "Other",
    });
    const otherUrl = await uploadUrl(other.cookies);
    expect((await authPost("/update-user", { image: otherUrl })).status).toBe(
      200,
    );
    expect((await storedUser(me.userId))?.image).toBe(myUrl);
  });

  it("applies the name and drops the image in a mixed update", async () => {
    const response = await authPost("/update-user", {
      name: "Renamed",
      image: "https://tracker.example/pixel.png",
    });
    expect(response.status).toBe(200);
    expect(await storedUser(me.userId)).toEqual({
      name: "Renamed",
      image: myUrl,
    });
  });

  it("stores no picture from sign-up", async () => {
    const response = await app.request("/api/auth/sign-up/email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "new@example.com",
        password: "correct horse battery staple",
        name: "New",
        image: "https://tracker.example/pixel.png",
      }),
    });
    expect(response.status).toBe(200);
    const { user } = (await response.json()) as { user: { id: string } };
    expect((await storedUser(user.id))?.image).toBeNull();
  });

  describe("admin endpoints", () => {
    let admin: { userId: string; cookies: string };

    beforeEach(async () => {
      admin = await signUpWithSession(app, {
        email: "admin@example.com",
        name: "Ada Admin",
        role: "admin",
      });
    });

    it("stores no picture from admin create-user", async () => {
      const response = await authPost(
        "/admin/create-user",
        {
          email: "created@example.com",
          password: "correct horse battery staple",
          name: "Created",
          data: { image: "https://tracker.example/pixel.png" },
        },
        admin.cookies,
      );
      expect(response.status, await response.clone().text()).toBe(200);
      const { user } = (await response.json()) as { user: { id: string } };
      expect((await storedUser(user.id))?.image).toBeNull();
    });

    it("ignores image in admin update-user, alone or with a name", async () => {
      const imageOnly = await authPost(
        "/admin/update-user",
        { userId: me.userId, data: { image: "https://tracker.example/x" } },
        admin.cookies,
      );
      expect(imageOnly.status, await imageOnly.clone().text()).toBe(200);
      expect((await storedUser(me.userId))?.image).toBe(myUrl);

      const mixed = await authPost(
        "/admin/update-user",
        {
          userId: me.userId,
          data: { name: "Admin Renamed", image: null },
        },
        admin.cookies,
      );
      expect(mixed.status).toBe(200);
      expect(await storedUser(me.userId)).toEqual({
        name: "Admin Renamed",
        image: myUrl,
      });
    });

    it("still changes the picture through the admin avatar route", async () => {
      const response = await adminUsersApi(app, { cookie: admin.cookies })(
        `/${me.userId}/avatar`,
        { method: "DELETE" },
      );
      expect(await response.json()).toEqual({ removed: true });
      expect(await avatarState(me.userId)).toEqual({ image: null, rowIds: [] });
    });
  });
});
