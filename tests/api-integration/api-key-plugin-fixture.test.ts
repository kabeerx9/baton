import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { signIn } from "./helpers/auth-session";
import { resetTestDatabase } from "./helpers/database";
import {
  pluginKeyFixture,
  pluginKeyNames,
  pluginKeyRow,
  replayPluginKeyRequests,
} from "./helpers/plugin-api-keys";

// auth-boundary P4 A1: keys the Better Auth plugin made, recorded before it
// left (`tests/fixtures/api-keys/`), behave the same under Baton's code.

const bcrypt = createRequire(
  new URL("../../apps/api/package.json", import.meta.url),
)("bcryptjs") as { hash(value: string, rounds: number): Promise<string> };

const { owner, workspace, keys, behaviour } = pluginKeyFixture;

async function seed() {
  await db.insert(schema.userTable).values({ ...owner, emailVerified: true });
  await db.insert(schema.accountTable).values({
    accountId: owner.id,
    providerId: "credential",
    userId: owner.id,
    password: await bcrypt.hash("correct horse battery staple", 4),
  });
  await db.insert(schema.workspaceTable).values({
    ...workspace,
    slug: workspace.id,
    createdAt: new Date(),
  });
  await db.insert(schema.workspaceUserTable).values({
    workspaceId: workspace.id,
    userId: owner.id,
    role: "owner",
    joinedAt: new Date(),
  });
  const now = Date.now();
  await db
    .insert(schema.apikeyTable)
    .values(pluginKeyNames.map((name) => pluginKeyRow(name, now)));
}

beforeEach(async () => {
  await resetTestDatabase();
  await seed();
});

describe("plugin-made API keys under Baton's verifier (A1)", () => {
  it("stores the hash Baton computes for each secret", () => {
    for (const name of pluginKeyNames) {
      const { secret, row } = keys[name];
      expect(row.key, name).toBe(
        createHash("sha256").update(secret).digest("base64url"),
      );
    }
  });

  it("answers every recorded request as the plugin-era API did", async () => {
    const { app } = createApp();
    const seen = await replayPluginKeyRequests(app);
    expect(seen).toEqual(behaviour);
    // The cases the record names, spelled out.
    expect(seen.expired!["/api/user/me"]![0]!.status).toBe(401);
    expect(seen.disabled!["/api/user/me"]![0]!.status).toBe(401);
    expect(seen.scoped!["/api/workspace"]![0]!.code).toBe("API_KEY_SCOPE");
    expect(
      seen["rate-limited"]!["/api/user/me"]!.map((entry) => entry.status),
    ).toEqual([200, 200, 200, 429]);
  });

  it("lists and deletes each one through the new routes", async () => {
    const { app } = createApp();
    const cookie = await signIn(app, owner.email);

    const listed = await app.request("/api/api-key", { headers: { cookie } });
    expect(listed.status).toBe(200);
    const text = await listed.text();
    const items = JSON.parse(text) as {
      id: string;
      name: string;
      prefix: string | null;
      enabled: boolean;
      permissions: unknown;
    }[];
    expect(items.map((item) => item.id).sort()).toEqual(
      pluginKeyNames.map((name) => keys[name].row.id).sort(),
    );
    const byId = new Map(items.map((item) => [item.id, item]));
    expect(byId.get(keys.prefixed.row.id)).toMatchObject({ prefix: "bat_" });
    expect(byId.get(keys.disabled.row.id)).toMatchObject({ enabled: false });
    expect(byId.get(keys.scoped.row.id)).toMatchObject({
      permissions: { task: ["read"], project: ["read"] },
    });
    for (const name of pluginKeyNames) {
      expect(text).not.toContain(keys[name].secret);
      expect(text).not.toContain(keys[name].row.key);
    }

    for (const name of pluginKeyNames) {
      const deleted = await app.request(`/api/api-key/${keys[name].row.id}`, {
        method: "DELETE",
        headers: { cookie },
      });
      expect(deleted.status, name).toBe(200);
      const after = await app.request("/api/user/me", {
        headers: { "x-api-key": keys[name].secret },
      });
      expect(after.status, name).toBe(401);
    }
    expect(await db.select().from(schema.apikeyTable)).toEqual([]);
  });
});
