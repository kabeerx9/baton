import { beforeEach, describe, expect, it } from "vite-plus/test";
import { auth } from "../../apps/api/src/identity/better-auth/auth";
import db from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { decodeAvatarUpload } from "../../apps/api/src/user/avatar";
import { clearUserAvatar } from "../../apps/api/src/user/avatar-store/clear-user-avatar";
import { replaceUserAvatar } from "../../apps/api/src/user/avatar-store/replace-user-avatar";
import { signUpWithSession } from "./helpers/auth-session";
import {
  avatarState,
  deferred,
  expectAvatarInSync,
  injectFailure,
  PNG_UPLOAD,
  settlesWithin,
} from "./helpers/avatar/avatar-state";
import { resetTestDatabase } from "./helpers/database";
import { connectMcpAgent } from "./helpers/mcp-oauth";

type App = ReturnType<typeof createApp>["app"];
type Avatar = { id: string; url: string; size: number };

let app: App;
let me: { userId: string; cookies: string };

const send = (method: "PUT" | "DELETE", headers: Record<string, string>) =>
  app.request("/api/user/avatar", {
    method,
    headers: {
      "content-type": "application/json",
      origin: "http://localhost:5173",
      ...headers,
    },
    ...(method === "PUT" ? { body: JSON.stringify(PNG_UPLOAD) } : {}),
  });
const upload = (cookies = me.cookies) => send("PUT", { cookie: cookies });
const remove = (cookies = me.cookies) => send("DELETE", { cookie: cookies });

async function uploadOk(cookies = me.cookies) {
  const response = await upload(cookies);
  expect(response.status, await response.clone().text()).toBe(200);
  return (await response.json()) as Avatar;
}

async function sessionImage(cookies = me.cookies) {
  const response = await app.request("/api/auth/get-session", {
    headers: { cookie: cookies },
  });
  const body = (await response.json()) as { user: { image: string | null } };
  return body.user.image;
}

beforeEach(async () => {
  await resetTestDatabase();
  ({ app } = createApp());
  me = await signUpWithSession(app, { email: "me@example.com", name: "Me" });
});

describe("own avatar writes are atomic", () => {
  it("sets user.image to the stored avatar in the same request", async () => {
    const avatar = await uploadOk();
    expect(await avatarState(me.userId)).toEqual({
      image: avatar.url,
      rowIds: [avatar.id],
    });
    expect(await sessionImage()).toBe(avatar.url);
    expect((await app.request(avatar.url)).status).toBe(200);
  });

  it("replaces the picture: the old URL dies, the new one serves", async () => {
    const first = await uploadOk();
    const second = await uploadOk();
    expect(second.id).not.toBe(first.id);
    expect((await app.request(first.url)).status).toBe(404);
    expect((await app.request(second.url)).status).toBe(200);
    expect((await expectAvatarInSync(me.userId)).image).toBe(second.url);
  });

  it("rolls back the stored picture when the user update fails", async () => {
    const before = await uploadOk();
    const restore = await injectFailure("user", "BEFORE UPDATE OF image");
    try {
      const response = await upload();
      expect(response.status).toBe(500);
    } finally {
      await restore();
    }
    expect(await avatarState(me.userId)).toEqual({
      image: before.url,
      rowIds: [before.id],
    });
    expect((await app.request(before.url)).status).toBe(200);
  });

  it("rolls back the row deletion when clearing user.image fails", async () => {
    const before = await uploadOk();
    const restore = await injectFailure("user", "BEFORE UPDATE OF image");
    try {
      expect((await remove()).status).toBe(500);
    } finally {
      await restore();
    }
    expect(await avatarState(me.userId)).toEqual({
      image: before.url,
      rowIds: [before.id],
    });
  });

  it("deletes the row and clears user.image, with or without a row", async () => {
    await uploadOk();
    const removed = await remove();
    expect(await removed.json()).toEqual({ deleted: true });
    expect(await avatarState(me.userId)).toEqual({ image: null, rowIds: [] });
    expect(await sessionImage()).toBeNull();

    const again = await remove();
    expect(again.status).toBe(200);
    expect(await again.json()).toEqual({ deleted: false });
    expect(await avatarState(me.userId)).toEqual({ image: null, rowIds: [] });
  });

  it("refuses an invalid image and changes nothing", async () => {
    const before = await uploadOk();
    const response = await app.request("/api/user/avatar", {
      method: "PUT",
      headers: { "content-type": "application/json", cookie: me.cookies },
      body: JSON.stringify({
        contentType: "image/jpeg",
        data: PNG_UPLOAD.data,
      }),
    });
    expect(response.status).toBe(400);
    expect(await avatarState(me.userId)).toEqual({
      image: before.url,
      rowIds: [before.id],
    });
  });
});

describe("own avatar authorization", () => {
  it("requires credentials", async () => {
    expect((await send("PUT", {})).status).toBe(401);
    expect((await send("DELETE", {})).status).toBe(401);
  });

  it("rejects API keys and agent tokens and changes nothing", async () => {
    const before = await uploadOk();
    const { key } = await auth.api.createApiKey({
      body: { userId: me.userId, name: "Avatar test" },
    });
    const agent = await connectMcpAgent(app, { cookie: me.cookies });

    for (const headers of [
      { "x-api-key": key },
      { authorization: `Bearer ${agent.accessToken}` },
    ]) {
      for (const method of ["PUT", "DELETE"] as const) {
        const response = await send(method, headers);
        expect(response.status, `${method} ${Object.keys(headers)}`).toBe(403);
        expect(await response.json()).toMatchObject({
          code: "SESSION_REQUIRED",
        });
      }
    }
    expect(await avatarState(me.userId)).toEqual({
      image: before.url,
      rowIds: [before.id],
    });
  });

  it("acts only on the signed-in user's own picture", async () => {
    const other = await signUpWithSession(app, {
      email: "other@example.com",
      name: "Other",
    });
    const mine = await uploadOk();
    await uploadOk(other.cookies);
    expect(await (await remove(other.cookies)).json()).toEqual({
      deleted: true,
    });
    expect(await avatarState(me.userId)).toEqual({
      image: mine.url,
      rowIds: [mine.id],
    });
  });
});

describe("own avatar concurrency", () => {
  const decoded = decodeAvatarUpload(PNG_UPLOAD);

  it("a delete waits for a first upload in flight, then removes it", async () => {
    const held = deferred();
    const locked = deferred();
    const holder = db.transaction(async (tx) => {
      await replaceUserAvatar(tx, me.userId, decoded);
      locked.resolve();
      await held.promise;
    });
    await locked.promise;

    const deletion = remove();
    try {
      expect(await settlesWithin(deletion)).toBe("pending");
    } finally {
      held.resolve();
      await holder;
    }

    const response = await deletion;
    expect(await response.json()).toEqual({ deleted: true });
    expect(await avatarState(me.userId)).toEqual({ image: null, rowIds: [] });
  });

  it("an upload waits for a delete in flight, then wins", async () => {
    await uploadOk();
    const held = deferred();
    const locked = deferred();
    const holder = db.transaction(async (tx) => {
      await clearUserAvatar(tx, me.userId);
      locked.resolve();
      await held.promise;
    });
    await locked.promise;

    const uploading = upload();
    try {
      expect(await settlesWithin(uploading)).toBe("pending");
    } finally {
      held.resolve();
      await holder;
    }

    const avatar = (await (await uploading).json()) as Avatar;
    expect(await avatarState(me.userId)).toEqual({
      image: avatar.url,
      rowIds: [avatar.id],
    });
  });

  it("two uploads at once leave user.image on the surviving row", async () => {
    const results = await Promise.all([upload(), upload()]);
    expect(results.map((response) => response.status)).toEqual([200, 200]);
    const { rowIds } = await expectAvatarInSync(me.userId);
    expect(rowIds).toHaveLength(1);
  });

  it("stays in sync without deadlock across repeated mixed rounds", async () => {
    for (let round = 0; round < 15; round += 1) {
      const results = await Promise.all([
        upload(),
        remove(),
        upload(),
        remove(),
      ]);
      expect(results.map((response) => response.status)).toEqual([
        200, 200, 200, 200,
      ]);
      await expectAvatarInSync(me.userId);
    }
  });
});
