/**
 * Records `plugin-api-keys.json`: API key rows made by the Better Auth
 * `apiKey` plugin, and how the API answered each key while the plugin was
 * still installed (auth-boundary P4 A1). Run once, before the plugin left:
 *
 *   DATABASE_URL=postgresql://…/baton_test \
 *     pnpm --dir apps/api exec vp test run \
 *     --config ../../tests/fixtures/api-keys/record.config.ts
 *
 * How each key was made:
 * - `plain`, `prefixed`, `expiring`: the plugin's create endpoint, as the web
 *   settings page called it (`name`, optional `prefix`, `expiresIn`).
 * - `rate-limited`, `scoped`: the plugin's server-only create body
 *   (`rateLimitMax`/`rateLimitTimeWindow`, `permissions`); no client could set
 *   these.
 * - `disabled`: created, then disabled with the plugin's `updateApiKey`.
 * - `expired`: created with the shortest `expiresIn` the plugin allows (one
 *   day), then `expires_at` is moved one hour into the past with SQL. The
 *   plugin cannot make an already-expired key.
 *
 * Times are stored as offsets in milliseconds from the moment of recording,
 * so the replay keeps them relative to its own clock. The secrets are
 * throwaway test values for a throwaway database.
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { eq } from "drizzle-orm";
import { expect, it } from "vite-plus/test";
import db, { schema } from "../../../apps/api/src/database";
import { auth } from "../../../apps/api/src/identity/better-auth/auth";
import { createApp } from "../../../apps/api/src/index";
import { resetTestDatabase } from "../../api-integration/helpers/database";

const OWNER = {
  id: "fixture-key-owner",
  email: "fixture-key-owner@example.com",
  name: "Fixture key owner",
};
const WORKSPACE = { id: "fixture-key-workspace", name: "Fixture keys" };
const DAY = 86_400;

type ApiKeyRow = typeof schema.apikeyTable.$inferSelect;
type Observed = {
  status: number;
  code: string | null;
  headers: Record<string, string | null>;
};

const RATE_HEADERS = [
  "x-ratelimit-limit",
  "x-ratelimit-remaining",
  "x-ratelimit-reset",
  "retry-after",
];

async function observe(
  app: ReturnType<typeof createApp>["app"],
  path: string,
  key: string,
): Promise<Observed> {
  const response = await app.request(path, { headers: { "x-api-key": key } });
  const body = (await response.json().catch(() => null)) as {
    code?: string;
  } | null;
  return {
    status: response.status,
    code: body?.code ?? null,
    // Reset and Retry-After move with the clock: record presence only.
    headers: Object.fromEntries(
      RATE_HEADERS.map((name) => {
        const value = response.headers.get(name);
        if (value === null) return [name, null];
        return [
          name,
          name === "x-ratelimit-reset" || name === "retry-after"
            ? "present"
            : value,
        ];
      }),
    ),
  };
}

function offsets(row: ApiKeyRow, recordedAt: number) {
  const toOffset = (date: Date | null) =>
    date === null ? null : date.getTime() - recordedAt;
  return {
    ...row,
    createdAt: toOffset(row.createdAt),
    updatedAt: toOffset(row.updatedAt),
    expiresAt: toOffset(row.expiresAt),
    lastRefillAt: toOffset(row.lastRefillAt),
    lastRequest: toOffset(row.lastRequest),
  };
}

it("records plugin-made API keys and their behaviour", async () => {
  await resetTestDatabase();
  await db.insert(schema.userTable).values({ ...OWNER, emailVerified: true });
  await db.insert(schema.workspaceTable).values({
    ...WORKSPACE,
    slug: WORKSPACE.id,
    createdAt: new Date(),
  });
  await db.insert(schema.workspaceUserTable).values({
    workspaceId: WORKSPACE.id,
    userId: OWNER.id,
    role: "owner",
    joinedAt: new Date(),
  });

  const create = (body: Record<string, unknown>) =>
    auth.api.createApiKey({ body: { userId: OWNER.id, ...body } as never });

  const made = {
    plain: await create({ name: "Plain" }),
    prefixed: await create({ name: "Prefixed", prefix: "bat_" }),
    "rate-limited": await create({
      name: "Rate limited",
      rateLimitMax: 3,
      rateLimitTimeWindow: 60_000,
    }),
    scoped: await create({
      name: "Scoped",
      permissions: { task: ["read"], project: ["read"] },
    }),
    expiring: await create({ name: "Expiring", expiresIn: 30 * DAY }),
    expired: await create({ name: "Expired", expiresIn: DAY }),
    disabled: await create({ name: "Disabled" }),
  };
  await auth.api.updateApiKey({
    body: { keyId: made.disabled.id, userId: OWNER.id, enabled: false },
  });
  await db
    .update(schema.apikeyTable)
    .set({ expiresAt: new Date(Date.now() - 60 * 60 * 1000) })
    .where(eq(schema.apikeyTable.id, made.expired.id));

  // Rows as the plugin left them, before any request touched their counters.
  const recordedAt = Date.now();
  const rows = await db.select().from(schema.apikeyTable);
  const keys = Object.fromEntries(
    Object.entries(made).map(([name, { id, key }]) => {
      const row = rows.find((candidate) => candidate.id === id)!;
      return [name, { secret: key, row: offsets(row, recordedAt) }];
    }),
  );

  const { app } = createApp();
  const behaviour: Record<string, Record<string, Observed[]>> = {};
  for (const [name, { key }] of Object.entries(made)) {
    behaviour[name] = {
      "/api/user/me": [await observe(app, "/api/user/me", key)],
    };
  }
  // The rate-limited key had one request above; three more reach the limit.
  for (let i = 0; i < 3; i += 1) {
    behaviour["rate-limited"]!["/api/user/me"]!.push(
      await observe(app, "/api/user/me", made["rate-limited"].key),
    );
  }
  behaviour.scoped!["/api/workspace"] = [
    await observe(app, "/api/workspace", made.scoped.key),
  ];
  behaviour.plain!["/api/workspace"] = [
    await observe(app, "/api/workspace", made.plain.key),
  ];

  expect(behaviour["rate-limited"]!["/api/user/me"]!.at(-1)!.status).toBe(429);

  writeFileSync(
    join(dirname(fileURLToPath(import.meta.url)), "plugin-api-keys.json"),
    `${JSON.stringify(
      {
        recordedWith: "@better-auth/api-key 1.7.14",
        owner: OWNER,
        workspace: WORKSPACE,
        keys,
        behaviour,
      },
      null,
      2,
    )}\n`,
  );
});
