import { randomUUID } from "node:crypto";
import { asc, count, eq } from "drizzle-orm";
import { expect } from "vite-plus/test";
import db, { schema } from "../../../apps/api/src/database";
import {
  workspaceMemberAccessTable,
  workspaceMemberRemovalTable,
} from "../../../apps/api/src/database/schema";
import { subscribeToEvent } from "../../../apps/api/src/events";
import { createApp } from "../../../apps/api/src/index";
import {
  DEFAULT_ROLE_NAMES,
  defaultRolePayloads,
} from "../../../packages/permissions/src";
import { signUpWithSession } from "./auth-session";
import { connectMcpAgent } from "./mcp-oauth";

// The workspace write routes of auth-boundary P3, driven the way the
// provider matrix (fixtures/workspace-permission-matrix.json) was captured.

export const ACTORS = [
  "owner",
  "admin",
  "member",
  "viewer",
  "custom",
  "outsider",
] as const;
export type Actor = (typeof ACTORS)[number];

export const CUSTOM_ROLE = {
  name: "reviewer",
  permission: {
    workspace: ["read"],
    organization: ["update"],
    member: ["update"],
    ac: ["read", "create"],
  },
};

const PEOPLE = [...ACTORS, "owner2", "target", "instanceAdmin"] as const;
export type Person = (typeof PEOPLE)[number];

export type Seeded = {
  workspaceId: string;
  /** The members' user ids by name (`owner2`, `target`, the actor). */
  userIds: Record<string, string>;
  /** Role row ids by role name. */
  roleIds: Record<string, string>;
};

type Request = {
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  path: string;
  body?: unknown;
};

/** The fixture's actions as Baton routes; paths are under `/api`. */
export const ACTIONS: Record<string, (s: Seeded) => Request> = {
  "workspace.read": (s) => ({
    method: "GET",
    path: `/workspace/${s.workspaceId}`,
  }),
  "members.list": (s) => ({
    method: "GET",
    path: `/workspace/${s.workspaceId}/members`,
  }),
  "workspace.update": (s) => ({
    method: "PATCH",
    path: `/workspace/${s.workspaceId}`,
    body: { name: "Renamed" },
  }),
  "workspace.delete": (s) => ({
    method: "DELETE",
    path: `/workspace/${s.workspaceId}`,
  }),
  "workspace.leave": (s) => ({
    method: "POST",
    path: `/workspace/${s.workspaceId}/leave`,
  }),
  "member.remove": (s) => ({
    method: "DELETE",
    path: `/workspace/${s.workspaceId}/members/${s.userIds.target}`,
  }),
  "member.remove-owner": (s) => ({
    method: "DELETE",
    path: `/workspace/${s.workspaceId}/members/${s.userIds.owner2}`,
  }),
  "member.role": (s) => ({
    method: "PUT",
    path: `/workspace/${s.workspaceId}/members/${s.userIds.target}/role`,
    body: { role: "viewer" },
  }),
  "member.role-of-owner": (s) => ({
    method: "PUT",
    path: `/workspace/${s.workspaceId}/members/${s.userIds.owner2}/role`,
    body: { role: "admin" },
  }),
  "member.role-to-owner": (s) => ({
    method: "PUT",
    path: `/workspace/${s.workspaceId}/members/${s.userIds.target}/role`,
    body: { role: "owner" },
  }),
  // Not in the provider fixture: the provider had no atomic transfer.
  "member.transfer": (s) => ({
    method: "PUT",
    path: `/workspace/${s.workspaceId}/owner`,
    body: { userId: s.userIds.target },
  }),
  "roles.list": (s) => ({
    method: "GET",
    path: `/workspace/${s.workspaceId}/roles`,
  }),
  "roles.create": (s) => ({
    method: "POST",
    path: `/workspace/${s.workspaceId}/roles`,
    body: { role: "extra", permission: { task: ["read"] } },
  }),
  "roles.create-beyond-own": (s) => ({
    method: "POST",
    path: `/workspace/${s.workspaceId}/roles`,
    body: { role: "extra", permission: { organization: ["delete"] } },
  }),
  "roles.update": (s) => ({
    method: "PATCH",
    path: `/workspace/${s.workspaceId}/roles/${s.roleIds.spare}`,
    body: { permission: { task: ["read"] } },
  }),
  "roles.update-beyond-own": (s) => ({
    method: "PATCH",
    path: `/workspace/${s.workspaceId}/roles/${s.roleIds.spare}`,
    body: { permission: { organization: ["delete"] } },
  }),
  "roles.update-seeded": (s) => ({
    method: "PATCH",
    path: `/workspace/${s.workspaceId}/roles/${s.roleIds.viewer}`,
    body: { permission: { workspace: ["read"] } },
  }),
  "roles.rename-to-owner": (s) => ({
    method: "PATCH",
    path: `/workspace/${s.workspaceId}/roles/${s.roleIds.spare}`,
    body: { role: "owner" },
  }),
  "roles.delete": (s) => ({
    method: "DELETE",
    path: `/workspace/${s.workspaceId}/roles/${s.roleIds.spare}`,
  }),
  "roles.delete-seeded": (s) => ({
    method: "DELETE",
    path: `/workspace/${s.workspaceId}/roles/${s.roleIds.viewer}`,
  }),
  "roles.delete-in-use": (s) => ({
    method: "DELETE",
    path: `/workspace/${s.workspaceId}/roles/${s.roleIds.member}`,
  }),
};

/** The write actions: every one but the three reads. */
export const WRITE_ACTIONS = Object.keys(ACTIONS).filter(
  (action) =>
    !["workspace.read", "members.list", "roles.list"].includes(action),
);

export type Cell = { status: number; code: string | null };

export async function writesFixture() {
  const { app } = createApp();
  const people = {} as Record<Person, { userId: string; cookies: string }>;
  for (const name of PEOPLE)
    people[name] = await signUpWithSession(app, {
      email: `${name.toLowerCase()}@example.com`,
      name,
      role: name === "instanceAdmin" ? "admin" : "user",
    });

  async function seed(
    actor: Actor | Person,
    options: {
      kind?: "team" | "demo";
      archived?: boolean;
      role?: string;
    } = {},
  ): Promise<Seeded> {
    const workspaceId = `ws-${randomUUID()}`;
    // One demo per person: a previous demo goes first.
    if (options.kind === "demo")
      await db
        .delete(schema.workspaceTable)
        .where(eq(schema.workspaceTable.kind, "demo"));
    await db.insert(schema.workspaceTable).values({
      id: workspaceId,
      name: "Matrix",
      slug: workspaceId,
      createdAt: new Date(),
      kind: options.kind ?? "team",
      archivedAt: options.archived ? new Date() : null,
      demoOwnerUserId:
        options.kind === "demo" ? people[actor as Person].userId : null,
    });
    const now = new Date();
    const roles = await db
      .insert(schema.workspaceRoleTable)
      .values([
        ...DEFAULT_ROLE_NAMES.map((role) => ({
          workspaceId,
          role,
          permission: JSON.stringify(defaultRolePayloads[role]),
          createdAt: now,
          updatedAt: now,
        })),
        {
          workspaceId,
          role: CUSTOM_ROLE.name,
          permission: JSON.stringify(CUSTOM_ROLE.permission),
          createdAt: now,
          updatedAt: now,
        },
        {
          workspaceId,
          role: "spare",
          permission: JSON.stringify({ task: ["read"] }),
          createdAt: now,
          updatedAt: now,
        },
      ])
      .returning({
        id: schema.workspaceRoleTable.id,
        role: schema.workspaceRoleTable.role,
      });
    const rows: Array<{ name: Person; role: string }> =
      options.kind === "demo"
        ? []
        : [
            { name: "owner2", role: "owner" },
            { name: "target", role: "member" },
          ];
    if (actor !== "outsider")
      rows.push({
        name: actor as Person,
        role:
          options.role ??
          (actor === "custom"
            ? CUSTOM_ROLE.name
            : options.kind === "demo"
              ? "owner"
              : actor),
      });
    if (options.kind === "demo" && actor !== "target")
      rows.push({ name: "target", role: "member" });
    // Joined one second apart, so the member list order is stable.
    await db.insert(schema.workspaceUserTable).values(
      rows.map((row, index) => ({
        workspaceId,
        userId: people[row.name].userId,
        role: row.role,
        joinedAt: new Date(now.getTime() + index * 1000),
      })),
    );
    return {
      workspaceId,
      userIds: Object.fromEntries(
        rows.map((row) => [row.name, people[row.name].userId]),
      ),
      roleIds: Object.fromEntries(roles.map((row) => [row.role, row.id])),
    };
  }

  async function call(
    request: Request,
    headers: Record<string, string>,
  ): Promise<Response> {
    return app.request(`/api${request.path}`, {
      method: request.method,
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:5173",
        ...headers,
      },
      body:
        request.body === undefined ? undefined : JSON.stringify(request.body),
    });
  }

  async function cell(
    request: Request,
    headers: Record<string, string>,
  ): Promise<Cell> {
    const response = await call(request, headers);
    const body = (await response.json().catch(() => null)) as {
      code?: string;
    } | null;
    return { status: response.status, code: body?.code ?? null };
  }

  /** An API key for `person`, scoped to `permissions` (null: unscoped). */
  async function keyFor(
    person: Person,
    permissions: Record<string, string[]> | null,
  ) {
    const response = await app.request("/api/api-key", {
      method: "POST",
      headers: {
        cookie: people[person].cookies,
        "content-type": "application/json",
      },
      body: JSON.stringify({ name: "writes" }),
    });
    expect(response.status).toBe(201);
    const key = (await response.json()) as { id: string; key: string };
    await db
      .update(schema.apikeyTable)
      .set({
        rateLimitEnabled: false,
        permissions: permissions === null ? null : JSON.stringify(permissions),
      })
      .where(eq(schema.apikeyTable.id, key.id));
    return key;
  }

  /** An MCP access token approved by `person`. */
  async function mcpTokenFor(person: Person) {
    const agent = await connectMcpAgent(app, {
      cookie: people[person].cookies,
    });
    return agent.accessToken;
  }

  const as = {
    cookie: (person: Person) => ({ cookie: people[person].cookies }),
    key: (key: string) => ({ "x-api-key": key }),
    bearer: (token: string) => ({ authorization: `Bearer ${token}` }),
  };

  return { app, people, seed, call, cell, keyFor, mcpTokenFor, as };
}

export type WritesFixture = Awaited<ReturnType<typeof writesFixture>>;

/**
 * Everything a refused write must leave as it was: the workspace and its
 * members, roles, removal markers and project limits, plus the outbox and
 * audit log sizes.
 */
export async function snapshot(workspaceId: string) {
  const [workspace] = await db
    .select()
    .from(schema.workspaceTable)
    .where(eq(schema.workspaceTable.id, workspaceId));
  const members = await db
    .select({
      userId: schema.workspaceUserTable.userId,
      role: schema.workspaceUserTable.role,
    })
    .from(schema.workspaceUserTable)
    .where(eq(schema.workspaceUserTable.workspaceId, workspaceId))
    .orderBy(asc(schema.workspaceUserTable.userId));
  const roles = await db
    .select({
      id: schema.workspaceRoleTable.id,
      role: schema.workspaceRoleTable.role,
      permission: schema.workspaceRoleTable.permission,
    })
    .from(schema.workspaceRoleTable)
    .where(eq(schema.workspaceRoleTable.workspaceId, workspaceId))
    .orderBy(asc(schema.workspaceRoleTable.id));
  const removals = await db
    .select({ userId: workspaceMemberRemovalTable.userId })
    .from(workspaceMemberRemovalTable)
    .where(eq(workspaceMemberRemovalTable.workspaceId, workspaceId));
  const access = await db
    .select({ userId: workspaceMemberAccessTable.userId })
    .from(workspaceMemberAccessTable)
    .where(eq(workspaceMemberAccessTable.workspaceId, workspaceId));
  const [outbox] = await db.select({ n: count() }).from(schema.outboxTable);
  const [audit] = await db
    .select({ n: count() })
    .from(schema.adminAuditLogTable);
  return {
    workspace,
    members,
    roles,
    removals,
    access,
    outbox: outbox?.n,
    audit: audit?.n,
  };
}

const WATCHED_EVENTS = [
  "workspace.created",
  "workspace.deleted",
  "project_members.updated",
  "project_access.updated",
  "task.bulk_unassigned",
];
const seen: Array<{ type: string; data: unknown }> = [];
let subscribed: Promise<void> | undefined;

/** The workspace events published in this process since the last reset. */
export async function watchEvents() {
  subscribed ??= Promise.all(
    WATCHED_EVENTS.map((type) =>
      subscribeToEvent(type, async (data) => {
        seen.push({ type, data });
      }),
    ),
  ).then(() => undefined);
  await subscribed;
  seen.length = 0;
  return {
    types: () => seen.map((event) => event.type),
    all: () => [...seen],
  };
}
