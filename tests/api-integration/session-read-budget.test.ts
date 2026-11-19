import pg from "pg";
import { beforeEach, expect, it, vi } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { signUpWithSession } from "./helpers/auth-session";
import { resetTestDatabase } from "./helpers/database";

beforeEach(resetTestDatabase);

function captureQueries() {
  const seen: string[] = [];
  const query = pg.Client.prototype.query;
  vi.spyOn(pg.Client.prototype, "query").mockImplementation(function (
    this: pg.Client,
    ...args: unknown[]
  ) {
    const first = args[0] as string | { text?: string };
    seen.push(typeof first === "string" ? first : (first?.text ?? ""));
    return (query as (...a: unknown[]) => unknown).apply(this, args);
  } as never);
  return seen;
}

const reads = (seen: string[], table: string) =>
  seen.filter((text) =>
    new RegExp(`^select[\\s\\S]*from "${table}"`, "i").test(text),
  ).length;

it("a cookie request reads the session once and the user row once", async () => {
  const { app } = createApp();
  const owner = await signUpWithSession(app, {
    email: "budget@example.com",
    name: "Budget",
    role: "user",
  });
  await db.insert(schema.workspaceTable).values({
    id: "budget-ws",
    name: "Budget",
    slug: "budget",
    createdAt: new Date(),
  });
  await db.insert(schema.workspaceUserTable).values({
    workspaceId: "budget-ws",
    userId: owner.userId,
    role: "owner",
    joinedAt: new Date(),
  });

  const seen = captureQueries();
  const response = await app.request("/api/workspace/budget-ws/capabilities", {
    headers: { cookie: owner.cookies },
  });
  expect(response.status).toBe(200);
  // The provider's user read, then Baton's canSignIn read (ban and instance
  // role together). Before P3 the role was read twice more: by workspace
  // access and by isInstanceAdmin.
  expect({
    session: reads(seen, "session"),
    user: reads(seen, "user"),
  }).toEqual({ session: 1, user: 2 });
  expect(seen.length).toBeLessThanOrEqual(6);
});

it("an API key request never reads the instance role", async () => {
  const { app } = createApp();
  const owner = await signUpWithSession(app, {
    email: "budget@example.com",
    name: "Budget",
    role: "user",
  });
  await db.insert(schema.workspaceTable).values({
    id: "budget-ws",
    name: "Budget",
    slug: "budget",
    createdAt: new Date(),
  });
  await db.insert(schema.workspaceUserTable).values({
    workspaceId: "budget-ws",
    userId: owner.userId,
    role: "owner",
    joinedAt: new Date(),
  });
  const created = await app.request("/api/api-key", {
    method: "POST",
    headers: { cookie: owner.cookies, "content-type": "application/json" },
    body: JSON.stringify({ name: "budget" }),
  });
  const { key } = (await created.json()) as { key: string };

  const seen = captureQueries();
  const response = await app.request("/api/workspace/budget-ws/capabilities", {
    headers: { "x-api-key": key },
  });
  expect(response.status).toBe(200);
  const roleReads = seen.filter((text) =>
    /^select "role" from "user"/i.test(text),
  ).length;
  // Workspace routes have no instance-admin branch, so nothing reads it.
  expect(roleReads).toBe(0);
});
