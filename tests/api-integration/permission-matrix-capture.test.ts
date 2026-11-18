// One-off capture of the provider's organization endpoints (auth-boundary P3).
// Run with CAPTURE_PERMISSION_MATRIX=1 on the tree that still has the
// organization plugin; it writes fixtures/workspace-permission-matrix.json.
// The plugin's removal deletes this file; the fixture stays as the contract.
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import {
  DEFAULT_ROLE_NAMES,
  defaultRolePayloads,
} from "../../packages/permissions/src";
import { signUpWithSession } from "./helpers/auth-session";
import { resetTestDatabase } from "./helpers/database";

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, "fixtures/workspace-permission-matrix.json");

export const CUSTOM_ROLE = {
  name: "reviewer",
  permission: {
    workspace: ["read"],
    organization: ["update"],
    member: ["update"],
    ac: ["read", "create"],
  },
};

const ACTORS = ["owner", "admin", "member", "viewer", "custom", "outsider"];

type Cell = { status: number; code: string | null };
type Ids = {
  workspaceId: string;
  targetMemberId: string;
  ownerMemberId: string;
};

// Each action is the provider request plus the key scope the API-key gate
// asked for (`utils/native-auth-api-key.ts`).
const ACTIONS: Record<
  string,
  {
    method: "GET" | "POST";
    path: string;
    input: (ids: Ids) => Record<string, unknown>;
    scope: Record<string, string[]>;
  }
> = {
  "workspace.read": {
    method: "GET",
    path: "get-full-organization",
    input: (ids) => ({ organizationId: ids.workspaceId }),
    scope: { workspace: ["read"] },
  },
  "members.list": {
    method: "GET",
    path: "list-members",
    input: (ids) => ({ organizationId: ids.workspaceId }),
    scope: { workspace: ["read"] },
  },
  "workspace.update": {
    method: "POST",
    path: "update",
    input: (ids) => ({
      organizationId: ids.workspaceId,
      data: { name: "Renamed" },
    }),
    scope: { organization: ["update"] },
  },
  "workspace.delete": {
    method: "POST",
    path: "delete",
    input: (ids) => ({ organizationId: ids.workspaceId }),
    scope: { organization: ["delete"] },
  },
  "workspace.leave": {
    method: "POST",
    path: "leave",
    input: (ids) => ({ organizationId: ids.workspaceId }),
    scope: { workspace: ["manage_settings"] },
  },
  "member.remove": {
    method: "POST",
    path: "remove-member",
    input: (ids) => ({
      organizationId: ids.workspaceId,
      memberIdOrEmail: ids.targetMemberId,
    }),
    scope: { member: ["delete"] },
  },
  "member.remove-owner": {
    method: "POST",
    path: "remove-member",
    input: (ids) => ({
      organizationId: ids.workspaceId,
      memberIdOrEmail: ids.ownerMemberId,
    }),
    scope: { member: ["delete"] },
  },
  "member.role": {
    method: "POST",
    path: "update-member-role",
    input: (ids) => ({
      organizationId: ids.workspaceId,
      memberId: ids.targetMemberId,
      role: "viewer",
    }),
    scope: { member: ["update"] },
  },
  "member.role-of-owner": {
    method: "POST",
    path: "update-member-role",
    input: (ids) => ({
      organizationId: ids.workspaceId,
      memberId: ids.ownerMemberId,
      role: "admin",
    }),
    scope: { member: ["update"] },
  },
  "member.role-to-owner": {
    method: "POST",
    path: "update-member-role",
    input: (ids) => ({
      organizationId: ids.workspaceId,
      memberId: ids.targetMemberId,
      role: "owner",
    }),
    scope: { member: ["update"] },
  },
  "roles.list": {
    method: "GET",
    path: "list-roles",
    input: (ids) => ({ organizationId: ids.workspaceId }),
    scope: { ac: ["read"] },
  },
  "roles.create": {
    method: "POST",
    path: "create-role",
    input: (ids) => ({
      organizationId: ids.workspaceId,
      role: "extra",
      permission: { task: ["read"] },
    }),
    scope: { ac: ["create"] },
  },
  "roles.create-beyond-own": {
    method: "POST",
    path: "create-role",
    input: (ids) => ({
      organizationId: ids.workspaceId,
      role: "extra",
      permission: { organization: ["delete"] },
    }),
    scope: { ac: ["create"] },
  },
  "roles.update": {
    method: "POST",
    path: "update-role",
    input: (ids) => ({
      organizationId: ids.workspaceId,
      roleName: "spare",
      data: { permission: { task: ["read"] } },
    }),
    scope: { ac: ["update"] },
  },
  "roles.update-beyond-own": {
    method: "POST",
    path: "update-role",
    input: (ids) => ({
      organizationId: ids.workspaceId,
      roleName: "spare",
      data: { permission: { organization: ["delete"] } },
    }),
    scope: { ac: ["update"] },
  },
  "roles.update-seeded": {
    method: "POST",
    path: "update-role",
    input: (ids) => ({
      organizationId: ids.workspaceId,
      roleName: "viewer",
      data: { permission: { workspace: ["read"] } },
    }),
    scope: { ac: ["update"] },
  },
  "roles.rename-to-owner": {
    method: "POST",
    path: "update-role",
    input: (ids) => ({
      organizationId: ids.workspaceId,
      roleName: "spare",
      data: { roleName: "owner" },
    }),
    scope: { ac: ["update"] },
  },
  "roles.delete": {
    method: "POST",
    path: "delete-role",
    input: (ids) => ({ organizationId: ids.workspaceId, roleName: "spare" }),
    scope: { ac: ["delete"] },
  },
  "roles.delete-seeded": {
    method: "POST",
    path: "delete-role",
    input: (ids) => ({ organizationId: ids.workspaceId, roleName: "viewer" }),
    scope: { ac: ["delete"] },
  },
  "roles.delete-in-use": {
    method: "POST",
    path: "delete-role",
    input: (ids) => ({ organizationId: ids.workspaceId, roleName: "member" }),
    scope: { ac: ["delete"] },
  },
};

describe.skipIf(!process.env.CAPTURE_PERMISSION_MATRIX)(
  "provider permission matrix capture",
  () => {
    it("records every role and action", { timeout: 600_000 }, async () => {
      await resetTestDatabase();
      const { app } = createApp();
      const users: Record<string, { userId: string; cookies: string }> = {};
      for (const name of [...ACTORS, "owner2", "target"]) {
        users[name] = await signUpWithSession(app, {
          email: `${name}@example.com`,
          name,
          role: "user",
        });
      }

      async function seed(
        actor: string,
        options: {
          kind?: "team" | "demo";
          archived?: boolean;
          role?: string;
        } = {},
      ): Promise<Ids> {
        const workspaceId = `ws-${randomUUID()}`;
        // One demo per person: the previous cell's demo goes first.
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
            options.kind === "demo" ? users[actor]!.userId : null,
        });
        const now = new Date();
        await db.insert(schema.workspaceRoleTable).values([
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
        ]);
        const rows = [
          { name: "owner2", role: "owner" },
          { name: "target", role: "member" },
        ];
        if (actor !== "outsider") {
          rows.push({
            name: actor,
            role:
              options.role ?? (actor === "custom" ? CUSTOM_ROLE.name : actor),
          });
        }
        const inserted = await db
          .insert(schema.workspaceUserTable)
          .values(
            rows.map((row) => ({
              workspaceId,
              userId: users[row.name]!.userId,
              role: row.role,
              joinedAt: now,
            })),
          )
          .returning({
            id: schema.workspaceUserTable.id,
            userId: schema.workspaceUserTable.userId,
          });
        const memberId = (name: string) =>
          inserted.find((row) => row.userId === users[name]!.userId)!.id;
        return {
          workspaceId,
          targetMemberId: memberId("target"),
          ownerMemberId: memberId("owner2"),
        };
      }

      async function call(
        action: string,
        ids: Ids,
        headers: Record<string, string>,
      ): Promise<Cell> {
        const spec = ACTIONS[action]!;
        const input = spec.input(ids);
        const url =
          spec.method === "GET"
            ? `/api/auth/organization/${spec.path}?${new URLSearchParams(input as Record<string, string>)}`
            : `/api/auth/organization/${spec.path}`;
        const response = await app.request(url, {
          method: spec.method,
          headers: {
            "content-type": "application/json",
            origin: "http://localhost:5173",
            ...headers,
          },
          body: spec.method === "POST" ? JSON.stringify(input) : undefined,
        });
        const body = (await response.json().catch(() => null)) as {
          code?: string;
        } | null;
        return { status: response.status, code: body?.code ?? null };
      }

      async function keyFor(
        user: string,
        permissions: Record<string, string[]> | null,
      ) {
        const response = await app.request("/api/auth/api-key/create", {
          method: "POST",
          headers: {
            cookie: users[user]!.cookies,
            "content-type": "application/json",
          },
          body: JSON.stringify({ name: "matrix" }),
        });
        expect(response.status).toBe(200);
        const key = (await response.json()) as { id: string; key: string };
        await db
          .update(schema.apikeyTable)
          .set({
            rateLimitEnabled: false,
            permissions:
              permissions === null ? null : JSON.stringify(permissions),
          })
          .where(eq(schema.apikeyTable.id, key.id));
        return key.key;
      }

      const roles: Record<string, Record<string, Cell>> = {};
      for (const actor of ACTORS) {
        roles[actor] = {};
        for (const action of Object.keys(ACTIONS)) {
          const ids = await seed(actor);
          roles[actor]![action] = await call(action, ids, {
            cookie: users[actor]!.cookies,
          });
        }
      }

      // The owner through an API key: unscoped, scoped to exactly the
      // action's permission, and read-only.
      const keys: Record<string, Record<string, Cell>> = {
        unscoped: {},
        exact: {},
        "workspace:read": {},
      };
      const unscoped = await keyFor("owner", null);
      const readOnly = await keyFor("owner", { workspace: ["read"] });
      for (const action of Object.keys(ACTIONS)) {
        const exact = await keyFor("owner", ACTIONS[action]!.scope);
        for (const [name, key] of [
          ["unscoped", unscoped],
          ["exact", exact],
          ["workspace:read", readOnly],
        ] as const) {
          const ids = await seed("owner");
          keys[name]![action] = await call(action, ids, { "x-api-key": key });
        }
      }

      // Creation has no workspace: session, and keys of each scope.
      const create = async (headers: Record<string, string>) => {
        const response = await app.request("/api/auth/organization/create", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            origin: "http://localhost:5173",
            ...headers,
          },
          body: JSON.stringify({ name: "Created", slug: `c-${randomUUID()}` }),
        });
        const body = (await response.json().catch(() => null)) as {
          code?: string;
        } | null;
        return { status: response.status, code: body?.code ?? null };
      };
      const creation = {
        session: await create({ cookie: users.member!.cookies }),
        unscopedKey: await create({ "x-api-key": unscoped }),
        manageSettingsKey: await create({
          "x-api-key": await keyFor("owner", {
            workspace: ["manage_settings"],
          }),
        }),
        readKey: await create({ "x-api-key": readOnly }),
      };

      // Hook-layer rules: archived, demo, and the owner-token quarantine.
      const rules: Record<string, Record<string, Cell>> = {
        archivedOwner: {},
        demoOwner: {},
        quarantinedOwnerToken: {},
      };
      for (const action of Object.keys(ACTIONS)) {
        rules.archivedOwner![action] = await call(
          action,
          await seed("owner", { archived: true }),
          { cookie: users.owner!.cookies },
        );
        rules.demoOwner![action] = await call(
          action,
          await seed("owner", { kind: "demo" }),
          { cookie: users.owner!.cookies },
        );
      }
      for (const action of ["member.remove", "member.remove-owner"]) {
        rules.quarantinedOwnerToken![action] = await call(
          action,
          await seed("admin", { role: "admin, owner" }),
          { cookie: users.admin!.cookies },
        );
      }

      writeFileSync(
        out,
        `${JSON.stringify(
          {
            source:
              "Better Auth organization plugin on kabeerx9/auth-p2-identity-port (b35e1f5), captured by permission-matrix-capture.test.ts",
            setup:
              "Each cell: a fresh team workspace with seeded viewer/member/admin roles, custom role 'reviewer' and unused role 'spare'; members owner2 (owner), target (member) and the actor. 'outsider' is signed in and not a member.",
            customRole: CUSTOM_ROLE,
            roles,
            ownerApiKeys: keys,
            creation,
            rules,
          },
          null,
          2,
        )}\n`,
      );
    });
  },
);
