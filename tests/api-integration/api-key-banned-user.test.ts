import { createHash, randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { verifyApiKey } from "../../apps/api/src/utils/verify-api-key";
import { signUpWithSession } from "./helpers/auth-session";
import { resetTestDatabase } from "./helpers/database";

async function createUserWithKey(
  ban: Partial<
    Pick<typeof schema.userTable.$inferInsert, "banned" | "banExpires">
  >,
) {
  const userId = `user-${randomUUID()}`;
  await db.insert(schema.userTable).values({
    id: userId,
    email: `${userId}@example.com`,
    emailVerified: true,
    name: "Key Owner",
    ...ban,
  });
  const key = `test_${randomUUID()}`;
  await db.insert(schema.apikeyTable).values({
    referenceId: userId,
    userId,
    key: createHash("sha256").update(key).digest("base64url"),
    enabled: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return { userId, key };
}

describe("API integration: API keys of banned users", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("accepts the key of a user who is not banned", async () => {
    const { userId, key } = await createUserWithKey({ banned: false });

    const result = await verifyApiKey(key);

    expect(result?.key.userId).toBe(userId);
  });

  it("accepts the key when the banned flag was never set", async () => {
    const { userId, key } = await createUserWithKey({ banned: null });

    const result = await verifyApiKey(key);

    expect(result?.key.userId).toBe(userId);
  });

  it("does not consume the window counter while rate limits are disabled", async () => {
    const { userId, key } = await createUserWithKey({ banned: false });
    await db
      .update(schema.apikeyTable)
      .set({ rateLimitEnabled: false, rateLimitMax: 1, requestCount: 0 })
      .where(eq(schema.apikeyTable.userId, userId));
    for (let i = 0; i < 3; i++)
      expect(await verifyApiKey(key)).toMatchObject({ status: "valid" });
    expect(
      (
        await db.query.apikeyTable.findFirst({
          where: eq(schema.apikeyTable.userId, userId),
        })
      )?.requestCount,
    ).toBe(0);
    await db
      .update(schema.apikeyTable)
      .set({ rateLimitEnabled: true })
      .where(eq(schema.apikeyTable.userId, userId));
    expect(await verifyApiKey(key)).toMatchObject({ status: "valid" });
    expect(await verifyApiKey(key)).toMatchObject({ status: "rate_limited" });
  });

  it("rejects the key of a banned user", async () => {
    const { key } = await createUserWithKey({ banned: true });

    expect(await verifyApiKey(key)).toBeNull();
  });

  it("rejects the key while a temporary ban is still active", async () => {
    const { key } = await createUserWithKey({
      banned: true,
      banExpires: new Date(Date.now() + 60 * 60 * 1000),
    });

    expect(await verifyApiKey(key)).toBeNull();
  });

  it("accepts the key once a temporary ban has expired", async () => {
    const { userId, key } = await createUserWithKey({
      banned: true,
      banExpires: new Date(Date.now() - 60 * 60 * 1000),
    });

    const result = await verifyApiKey(key);

    expect(result?.key.userId).toBe(userId);
  });

  describe("through the key routes", () => {
    async function mintKey() {
      const { app } = createApp();
      const owner = await signUpWithSession(app, {
        email: `${randomUUID()}@example.com`,
        name: "Key Owner",
      });
      const created = await app.request("/api/api-key", {
        method: "POST",
        headers: { "content-type": "application/json", cookie: owner.cookies },
        body: JSON.stringify({ name: "test" }),
      });
      expect(created.status).toBe(201);
      const { key } = (await created.json()) as { key: string };
      return { app, userId: owner.userId, key };
    }

    async function ban(userId: string) {
      await db
        .update(schema.userTable)
        .set({ banned: true })
        .where(eq(schema.userTable.id, userId));
    }

    it.each([
      ["x-api-key", (key: string) => ({ "x-api-key": key })],
      ["bearer", (key: string) => ({ authorization: `Bearer ${key}` })],
    ] as const)(
      "authenticates an active %s key and refuses it once banned",
      async (_, headersFor) => {
        const { app, userId, key } = await mintKey();
        const headers = headersFor(key);

        const active = await app.request("/api/user/me", { headers });
        expect(active.status).toBe(200);
        expect(((await active.json()) as { id: string }).id).toBe(userId);

        await ban(userId);

        const banned = await app.request("/api/user/me", { headers });
        expect(banned.status).toBe(401);
      },
    );

    it("does not let a browser cookie rescue a banned bearer key", async () => {
      const { app } = createApp();
      const viewer = await signUpWithSession(app, {
        email: `${randomUUID()}@example.com`,
        name: "Cookie Holder",
      });
      const { userId, key } = await mintKey();
      await ban(userId);

      const response = await app.request("/api/user/me", {
        headers: { authorization: `Bearer ${key}`, cookie: viewer.cookies },
      });

      expect(response.status).toBe(401);
    });

    it("refuses a key, banned or not, on the provider's routes", async () => {
      const { app, userId, key } = await mintKey();
      for (const banned of [false, true]) {
        if (banned) await ban(userId);
        for (const headers of [
          { "x-api-key": key },
          { authorization: `Bearer ${key}` },
        ]) {
          const response = await app.request("/api/auth/get-session", {
            headers,
          });
          expect(response.status).toBe(403);
          expect(await response.json()).toMatchObject({
            code: "SESSION_REQUIRED",
          });
        }
      }
    });
  });
});
