import { and, eq } from "drizzle-orm";
import { expect } from "vite-plus/test";
import db, { schema } from "../../../apps/api/src/database";
import { workspaceJoinLinkTable } from "../../../apps/api/src/database/schema";
import { createApp } from "../../../apps/api/src/index";
import { signUpWithSession } from "./auth-session";

type App = ReturnType<typeof createApp>["app"];

export type Person = { userId: string; cookies: string };

export type JoinLinkBody = {
  link: {
    id: string;
    state: string;
    url: string | null;
    expiresAt: string;
    createdAt: string;
    createdBy: { id: string; name: string } | null;
    maxUses: number | null;
    useCount: number;
  } | null;
};

export function api(app: App) {
  return (
    path: string,
    {
      method = "GET",
      body,
      headers = {},
    }: {
      method?: string;
      body?: unknown;
      headers?: Record<string, string>;
    } = {},
  ) =>
    app.request(`/api${path}`, {
      method,
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:5173",
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
}

/** An owner with a team workspace made through Better Auth, so role rows exist. */
export async function joinLinkFixture() {
  const { app } = createApp();
  const call = api(app);
  const owner = await signUpWithSession(app, {
    email: "owner@example.com",
    name: "Owner Person",
    role: "user",
  });
  const created = await call("/auth/organization/create", {
    method: "POST",
    body: { name: "Join Team", slug: "join-team" },
    headers: { cookie: owner.cookies },
  });
  expect(created.status).toBe(200);
  const workspace = (await created.json()) as { id: string; slug: string };

  let people = 0;
  const person = async (name = `Person ${++people}`, role = "user") =>
    signUpWithSession(app, {
      email: `${name.toLowerCase().replace(/\s+/g, "-")}@example.com`,
      name,
      role,
    });

  const createLink = async (
    body: Record<string, unknown> = {},
    by: Person = owner,
  ) => {
    const response = await call(`/join-link/workspace/${workspace.id}`, {
      method: "POST",
      body,
      headers: { cookie: by.cookies },
    });
    expect(response.status).toBe(201);
    const { link } = (await response.json()) as JoinLinkBody;
    const url = link!.url!;
    return { link: link!, token: url.slice(url.lastIndexOf("/") + 1) };
  };

  const join = (who: Person, token: string) =>
    call("/join-link/join", {
      method: "POST",
      body: { token },
      headers: { cookie: who.cookies },
    });

  const preview = (token: string) =>
    call("/join-link/preview", { method: "POST", body: { token } });

  const addMember = async (who: Person, role: string) => {
    await db.insert(schema.workspaceUserTable).values({
      workspaceId: workspace.id,
      userId: who.userId,
      role,
      joinedAt: new Date(),
    });
  };

  return {
    app,
    call,
    owner,
    workspace,
    person,
    createLink,
    join,
    preview,
    addMember,
  };
}

export async function memberRows(workspaceId: string, userId: string) {
  return db
    .select({
      id: schema.workspaceUserTable.id,
      role: schema.workspaceUserTable.role,
    })
    .from(schema.workspaceUserTable)
    .where(
      and(
        eq(schema.workspaceUserTable.workspaceId, workspaceId),
        eq(schema.workspaceUserTable.userId, userId),
      ),
    );
}

export async function linkRow(id: string) {
  const [row] = await db
    .select()
    .from(workspaceJoinLinkTable)
    .where(eq(workspaceJoinLinkTable.id, id));
  return row;
}
