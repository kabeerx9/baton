import { createHash } from "node:crypto";
import { EventEmitter, once } from "node:events";
import { createRequire } from "node:module";
import { eq } from "drizzle-orm";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import { serve } from "../../apps/api/node_modules/@hono/node-server";
import type { NodeWebSocket } from "../../apps/api/node_modules/@hono/node-ws";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { shutdownWebSocketAdapter } from "../../apps/api/src/ws";
import { signUpWithSession } from "./helpers/auth-session";
import { resetTestDatabase } from "./helpers/database";
import { readErrorBody } from "./helpers/error-body";
import { connectMcpAgent, mcpPost } from "./helpers/mcp-oauth";

// auth-boundary P4 A2 to A5: Baton's own key routes.

type App = ReturnType<typeof createApp>["app"];
type Socket = NodeWebSocket["wss"]["clients"] extends Set<infer S> ? S : never;
type Account = { userId: string; cookies: string };
type Created = {
  id: string;
  key: string;
  start: string | null;
  prefix: string | null;
  expiresAt: string | null;
  metadata: Record<string, unknown> | null;
  rateLimitEnabled: boolean;
  rateLimitMax: number | null;
  rateLimitTimeWindow: number | null;
};

const apiRequire = createRequire(
  new URL("../../apps/api/package.json", import.meta.url),
);
const WebSocket: new (
  url: string,
  options: { headers: Record<string, string> },
) => Socket = createRequire(apiRequire.resolve("@hono/node-ws"))(
  "ws",
).WebSocket;

const DAY = 86_400;
let app: App;
let owner: Account;
let other: Account;

function hashOf(secret: string) {
  return createHash("sha256").update(secret).digest("base64url");
}

function create(headers: Record<string, string>, body: unknown) {
  return app.request("/api/api-key", {
    method: "POST",
    headers: { ...headers, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function createOwn(body: Record<string, unknown> = { name: "Laptop" }) {
  const response = await create({ cookie: owner.cookies }, body);
  expect(response.status, await response.clone().text()).toBe(201);
  return (await response.json()) as Created;
}

beforeEach(async () => {
  await resetTestDatabase();
  ({ app } = createApp());
  owner = await signUpWithSession(app, {
    email: "owner@example.com",
    name: "Key Owner",
  });
  other = await signUpWithSession(app, {
    email: "other@example.com",
    name: "Someone Else",
  });
});

describe("POST /api/api-key (A2)", () => {
  it("returns the secret once, honours the prefix and expiresIn, and stores its hash", async () => {
    const before = Date.now();
    const created = await createOwn({
      name: "Deploys",
      prefix: "bat_",
      expiresIn: 7 * DAY,
      metadata: { purpose: "ci", nested: { runs: 3 } },
    });

    expect(created.key).toMatch(/^bat_[a-zA-Z]{64}$/);
    expect(created.start).toBe(created.key.slice(0, 6));
    expect(created.prefix).toBe("bat_");
    expect(created.metadata).toEqual({ purpose: "ci", nested: { runs: 3 } });
    expect(created).toMatchObject({
      rateLimitEnabled: true,
      rateLimitMax: 100,
      rateLimitTimeWindow: 60_000,
    });
    const expiresAt = Date.parse(created.expiresAt!);
    expect(expiresAt).toBeGreaterThanOrEqual(before + 7 * DAY * 1000);
    expect(expiresAt).toBeLessThanOrEqual(Date.now() + 7 * DAY * 1000);

    const [row] = await db
      .select()
      .from(schema.apikeyTable)
      .where(eq(schema.apikeyTable.id, created.id));
    expect(row).toMatchObject({
      key: hashOf(created.key),
      referenceId: owner.userId,
      metadata: JSON.stringify({ purpose: "ci", nested: { runs: 3 } }),
      permissions: null,
    });
  });

  it("authenticates on REST, /api/mcp and the WebSocket", async () => {
    const { key } = await createOwn();

    const me = await app.request("/api/user/me", {
      headers: { "x-api-key": key },
    });
    expect(me.status).toBe(200);
    expect(((await me.json()) as { id: string }).id).toBe(owner.userId);
    expect(me.headers.get("x-ratelimit-limit")).toBe("100");
    expect(me.headers.get("x-ratelimit-remaining")).toBe("99");

    expect((await mcpPost(app, key, "tools/list")).status).toBe(200);

    const created = createApp();
    const server = serve({
      fetch: created.app.fetch,
      hostname: "127.0.0.1",
      port: 0,
    });
    created.injectWebSocket(server);
    if (!server.listening) await once(server, "listening");
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("No port");
    const socket = new WebSocket(`ws://127.0.0.1:${address.port}/api/ws/user`, {
      headers: { "x-api-key": key },
    });
    socket.on("error", () => {});
    try {
      await once(socket, "open");
      expect(socket.readyState).toBe(1);
    } finally {
      socket.terminate();
      await shutdownWebSocketAdapter();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });

  it("refuses the key once it expires", async () => {
    const { id, key } = await createOwn({ name: "Short", expiresIn: DAY });
    await db
      .update(schema.apikeyTable)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(schema.apikeyTable.id, id));
    const response = await app.request("/api/user/me", {
      headers: { "x-api-key": key },
    });
    expect(response.status).toBe(401);
  });

  it("answers 429 after the 100th request in the window", async () => {
    const { id, key } = await createOwn();
    await db
      .update(schema.apikeyTable)
      .set({ requestCount: 99, lastRequest: new Date() })
      .where(eq(schema.apikeyTable.id, id));
    const last = await app.request("/api/user/me", {
      headers: { "x-api-key": key },
    });
    expect(last.status).toBe(200);
    expect(last.headers.get("x-ratelimit-remaining")).toBe("0");
    const limited = await app.request("/api/user/me", {
      headers: { "x-api-key": key },
    });
    expect(limited.status).toBe(429);
    expect(limited.headers.get("retry-after")).not.toBeNull();
  });

  it.each([
    ["a scope", { name: "x", permissions: { task: ["read"] } }],
    ["an owner", { name: "x", userId: "someone" }],
    ["a rate limit", { name: "x", rateLimitMax: 1_000_000 }],
    ["a long name", { name: "n".repeat(33) }],
    ["an empty prefix", { name: "x", prefix: "" }],
    ["an expiry under a day", { name: "x", expiresIn: DAY - 1 }],
    ["an expiry over a year", { name: "x", expiresIn: 366 * DAY }],
    ["metadata that is not an object", { name: "x", metadata: ["a"] }],
    ["metadata over 2 KB", { name: "x", metadata: { blob: "b".repeat(2048) } }],
  ])("refuses %s with 400 and stores nothing", async (_, body) => {
    const response = await create({ cookie: owner.cookies }, body);
    expect(response.status).toBe(400);
    expect(await db.select().from(schema.apikeyTable)).toEqual([]);
  });

  it("accepts a key with no name and no expiry", async () => {
    const created = await createOwn({ expiresIn: null });
    expect(created.expiresAt).toBeNull();
    expect(created.key).toMatch(/^[a-zA-Z]{64}$/);
  });
});

describe("GET /api/api-key (A3)", () => {
  it("lists the caller's keys without the secret or its hash", async () => {
    const first = await createOwn({ name: "First", metadata: { a: 1 } });
    const second = await createOwn({ name: "Second" });
    await signUpWithSession(app, { email: "x@example.com", name: "X" });
    const otherKey = await create(
      { cookie: other.cookies },
      { name: "Not mine" },
    );
    expect(otherKey.status).toBe(201);

    const response = await app.request("/api/api-key", {
      headers: { cookie: owner.cookies },
    });
    expect(response.status).toBe(200);
    const text = await response.text();
    const listed = JSON.parse(text) as Record<string, unknown>[];
    expect(listed.map((key) => key.name)).toEqual(["Second", "First"]);
    expect(listed[1]).toMatchObject({ metadata: { a: 1 } });
    for (const key of listed) expect(Object.keys(key)).not.toContain("key");
    for (const secret of [first.key, second.key]) {
      expect(text).not.toContain(secret);
      expect(text).not.toContain(hashOf(secret));
    }
  });

  it("puts the secret in no log line and no event", async () => {
    const logged: unknown[] = [];
    for (const method of ["log", "info", "warn", "error", "debug"] as const)
      vi.spyOn(console, method).mockImplementation((...args) => {
        logged.push(args);
      });
    const emitted: unknown[] = [];
    const emit = EventEmitter.prototype.emit;
    vi.spyOn(EventEmitter.prototype, "emit").mockImplementation(function (
      this: EventEmitter,
      ...args
    ) {
      // App events are named `resource.action`; the database driver's own
      // wire events (`dataRow`, …) carry stored rows and are not events.
      if (typeof args[0] === "string" && /^[a-z_]+\.[a-z_.]+$/.test(args[0]))
        emitted.push(args);
      return emit.apply(this, args);
    });

    const { id, key } = await createOwn({ name: "Watched" });
    await app.request("/api/user/me", { headers: { "x-api-key": key } });
    await app.request("/api/api-key", { headers: { cookie: owner.cookies } });
    await app.request("/api/auth/get-session", {
      headers: { "x-api-key": key },
    });
    await app.request(`/api/api-key/${id}`, {
      method: "DELETE",
      headers: { cookie: owner.cookies },
    });
    await app.request("/api/user/me", { headers: { "x-api-key": key } });

    const seen = (value: unknown) => {
      try {
        return JSON.stringify(value) ?? "";
      } catch {
        return String(value);
      }
    };
    for (const entry of [...logged, ...emitted]) {
      expect(seen(entry)).not.toContain(key);
      expect(seen(entry)).not.toContain(hashOf(key));
    }
    const stored = JSON.stringify(
      await Promise.all([
        db.select().from(schema.outboxTable),
        db.select().from(schema.adminAuditLogTable),
      ]),
    );
    expect(stored).not.toContain(key);
    expect(stored).not.toContain(hashOf(key));
  });
});

describe("who may manage keys (A4)", () => {
  it.each(["x-api-key", "bearer"] as const)(
    "refuses a key in %s on every key route with 403 and changes nothing",
    async (kind) => {
      const own = await createOwn();
      const headers =
        kind === "x-api-key"
          ? { "x-api-key": own.key }
          : { authorization: `Bearer ${own.key}` };
      const before = await db.select().from(schema.apikeyTable);

      const responses = [
        await app.request("/api/api-key", { headers }),
        await create(headers, { name: "Escaped" }),
        await app.request(`/api/api-key/${own.id}`, {
          method: "DELETE",
          headers,
        }),
      ];
      for (const response of responses) {
        expect(response.status).toBe(403);
        expect(await readErrorBody(response)).toMatchObject({
          code: "SESSION_REQUIRED",
        });
      }
      const after = await db.select().from(schema.apikeyTable);
      expect(after.map((row) => row.id)).toEqual(before.map((row) => row.id));
    },
  );

  it("refuses an MCP token on every key route with 403", async () => {
    const own = await createOwn();
    const agent = await connectMcpAgent(app, { cookie: owner.cookies });
    const headers = { authorization: `Bearer ${agent.accessToken}` };

    const responses = [
      await app.request("/api/api-key", { headers }),
      await create(headers, { name: "Escaped" }),
      await app.request(`/api/api-key/${own.id}`, {
        method: "DELETE",
        headers,
      }),
    ];
    for (const response of responses) {
      expect(response.status).toBe(403);
      expect(await readErrorBody(response)).toMatchObject({
        code: "SESSION_REQUIRED",
      });
    }
    expect(await db.select().from(schema.apikeyTable)).toHaveLength(1);
  });

  it("answers 404 for another user's key and leaves it working", async () => {
    const response = await create(
      { cookie: other.cookies },
      { name: "Theirs" },
    );
    const theirs = (await response.json()) as Created;

    const deleted = await app.request(`/api/api-key/${theirs.id}`, {
      method: "DELETE",
      headers: { cookie: owner.cookies },
    });
    expect(deleted.status).toBe(404);
    expect(await readErrorBody(deleted)).toMatchObject({
      code: "API_KEY_NOT_FOUND",
    });
    const stillWorks = await app.request("/api/user/me", {
      headers: { "x-api-key": theirs.key },
    });
    expect(stillWorks.status).toBe(200);
  });

  it("requires sign-in", async () => {
    expect((await app.request("/api/api-key")).status).toBe(401);
  });

  it("answers 404 on the provider's removed key routes", async () => {
    for (const [method, path] of [
      ["GET", "list"],
      ["POST", "create"],
      ["POST", "delete"],
      ["POST", "update"],
    ] as const) {
      const response = await app.request(`/api/auth/api-key/${path}`, {
        method,
        headers: { cookie: owner.cookies, "content-type": "application/json" },
        ...(method === "POST"
          ? { body: JSON.stringify({ name: "Old route" }) }
          : {}),
      });
      expect(response.status, path).toBe(404);
    }
    expect(await db.select().from(schema.apikeyTable)).toEqual([]);
  });
});

describe("DELETE /api/api-key/{id} (A5)", () => {
  it("deletes the key; requests with it fail at once", async () => {
    const { id, key } = await createOwn();
    const deleted = await app.request(`/api/api-key/${id}`, {
      method: "DELETE",
      headers: { cookie: owner.cookies },
    });
    expect(deleted.status).toBe(200);
    expect(await deleted.json()).toEqual({ id });
    const refused = await app.request("/api/user/me", {
      headers: { "x-api-key": key },
    });
    expect(refused.status).toBe(401);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});
