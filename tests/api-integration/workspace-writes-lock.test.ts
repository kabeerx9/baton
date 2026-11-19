// A13 and A16: authorization is read again under the workspace lock. Each
// case holds the workspace row, lets a request queue on it, changes one fact
// and commits, then releases the lock. The request must act on the new fact:
// refused, with no row, event or audit row written by it.
import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { workspaceMemberRemovalTable } from "../../apps/api/src/database/schema";
import { resetTestDatabase } from "./helpers/database";
import { holdRowLock, waitForLockWaiters } from "./helpers/row-lock";
import {
  ACTIONS,
  type Person,
  type Seeded,
  type WritesFixture,
  snapshot,
  watchEvents,
  writesFixture,
} from "./helpers/workspace-writes";

let ctx: WritesFixture;

beforeEach(async () => {
  await resetTestDatabase();
  ctx = await writesFixture();
});

type Family = {
  /** The member who acts. */
  actor: Person;
  /** What the actor's role must grant; also the key's scope. */
  scope: Record<string, string[]>;
  action: string;
};

const FAMILIES: Record<string, Family[]> = {
  "workspace update and delete": [
    {
      actor: "admin",
      scope: { workspace: ["update"] },
      action: "workspace.update",
    },
    {
      actor: "owner",
      scope: { workspace: ["delete"] },
      action: "workspace.delete",
    },
  ],
  "remove member and change role": [
    { actor: "admin", scope: { member: ["delete"] }, action: "member.remove" },
    { actor: "admin", scope: { member: ["update"] }, action: "member.role" },
  ],
  "transfer owner": [
    {
      actor: "owner",
      scope: { member: ["update"] },
      action: "member.transfer",
    },
  ],
  "role create, update and delete": [
    { actor: "admin", scope: { role: ["create"] }, action: "roles.create" },
    { actor: "admin", scope: { role: ["update"] }, action: "roles.update" },
    { actor: "admin", scope: { role: ["delete"] }, action: "roles.delete" },
  ],
  leave: [
    {
      actor: "member",
      scope: { workspace: ["manage_settings"] },
      action: "workspace.leave",
    },
  ],
};

const transferRequest = (s: Seeded) => ({
  method: "PUT" as const,
  path: `/workspace/${s.workspaceId}/owner`,
  body: { userId: s.userIds.target },
});
const requestFor = (action: string, s: Seeded) =>
  action === "member.transfer" ? transferRequest(s) : ACTIONS[action]!(s);

const setRole = (s: Seeded, userId: string, role: string) =>
  db
    .update(schema.workspaceUserTable)
    .set({ role })
    .where(
      and(
        eq(schema.workspaceUserTable.workspaceId, s.workspaceId),
        eq(schema.workspaceUserTable.userId, userId),
      ),
    );
const removeRow = (s: Seeded, userId: string) =>
  db
    .delete(schema.workspaceUserTable)
    .where(
      and(
        eq(schema.workspaceUserTable.workspaceId, s.workspaceId),
        eq(schema.workspaceUserTable.userId, userId),
      ),
    );
const setKey = (
  id: string,
  values: Partial<typeof schema.apikeyTable.$inferInsert>,
) =>
  db
    .update(schema.apikeyTable)
    .set(values)
    .where(eq(schema.apikeyTable.id, id));

type Change = (
  s: Seeded,
  key: { id: string },
  actor: Person,
) => Promise<unknown>;
type Case = {
  name: string;
  viaKey: boolean;
  change: Change;
  status: number;
  code: string;
};

function casesFor(family: Family): Case[] {
  const cases: Case[] = [
    {
      name: "the actor is removed",
      viaKey: false,
      change: (s, _key, actor) => removeRow(s, ctx.people[actor].userId),
      status: 403,
      code: "MEMBERSHIP_REQUIRED",
    },
    {
      name: "the key is disabled",
      viaKey: true,
      change: (_s, key) => setKey(key.id, { enabled: false }),
      status: 403,
      code: "CREDENTIAL_REVOKED",
    },
    {
      name: "the key is deleted",
      viaKey: true,
      change: (_s, key) =>
        db.delete(schema.apikeyTable).where(eq(schema.apikeyTable.id, key.id)),
      status: 403,
      code: "CREDENTIAL_REVOKED",
    },
    {
      name: "the key is narrowed",
      viaKey: true,
      change: (_s, key) =>
        setKey(key.id, {
          permissions: JSON.stringify({ workspace: ["read"] }),
        }),
      status: 403,
      code: "API_KEY_SCOPE",
    },
  ];
  if (family.action === "member.transfer")
    cases.push({
      name: "the actor is no longer an owner",
      viaKey: false,
      change: (s, _key, actor) => setRole(s, ctx.people[actor].userId, "admin"),
      status: 403,
      code: "OWNER_REQUIRED",
    });
  else if (family.action !== "workspace.leave")
    cases.push({
      name: "the actor is demoted",
      viaKey: false,
      change: (s, _key, actor) =>
        setRole(s, ctx.people[actor].userId, "viewer"),
      status: 403,
      code: "MISSING_PERMISSION",
    });
  if (
    ["member.remove", "member.role", "member.transfer"].includes(family.action)
  ) {
    cases.push({
      name: "the target is removed",
      viaKey: false,
      change: (s) => removeRow(s, s.userIds.target!),
      status: 404,
      code: "MEMBER_NOT_FOUND",
    });
  }
  if (["member.remove", "member.role"].includes(family.action))
    cases.push({
      name: "the target becomes an owner",
      viaKey: false,
      change: (s) => setRole(s, s.userIds.target!, "owner"),
      status: 403,
      code: "OWNER_REQUIRED",
    });
  if (["roles.update", "roles.delete"].includes(family.action))
    cases.push({
      name: "the role is deleted",
      viaKey: false,
      change: (s) =>
        db
          .delete(schema.workspaceRoleTable)
          .where(eq(schema.workspaceRoleTable.id, s.roleIds.spare!)),
      status: 404,
      code: "ROLE_NOT_FOUND",
    });
  return cases;
}

/**
 * Queues `family`'s request on the workspace lock, applies `change` while it
 * waits, then releases. Returns the response and whether the request left
 * the database and event stream exactly as the change did.
 */
async function raceUnderLock(
  family: Family,
  viaKey: boolean,
  change: (s: Seeded, key: { id: string; key: string }) => Promise<unknown>,
) {
  const s = await ctx.seed(family.actor);
  const key = await ctx.keyFor(family.actor, family.scope);
  const headers = viaKey ? ctx.as.key(key.key) : ctx.as.cookie(family.actor);
  const lock = await holdRowLock("workspace", s.workspaceId);
  const events = await watchEvents();
  let pending: Promise<Response> | undefined;
  let expected: Awaited<ReturnType<typeof snapshot>>;
  try {
    pending = ctx.call(requestFor(family.action, s), headers);
    await waitForLockWaiters(1);
    await change(s, key);
    expected = await snapshot(s.workspaceId);
  } finally {
    await lock.release();
  }
  const response = await pending!;
  const body = (await response.json()) as { code?: string };
  return {
    cell: { status: response.status, code: body.code ?? null },
    unchanged:
      JSON.stringify(await snapshot(s.workspaceId)) ===
      JSON.stringify(expected!),
    events: events.types(),
  };
}

describe("authorization under the lock (A13)", () => {
  for (const [name, family] of Object.entries(FAMILIES)) {
    it(name, { timeout: 120_000 }, async () => {
      for (const member of family)
        for (const c of casesFor(member)) {
          const got = await raceUnderLock(member, c.viaKey, (s, key) =>
            c.change(s, key, member.actor),
          );
          expect([member.action, c.name, got]).toEqual([
            member.action,
            c.name,
            {
              cell: { status: c.status, code: c.code },
              unchanged: true,
              events: [],
            },
          ]);
        }
    });
  }
});

describe("revocation in flight (A16)", () => {
  const revokeKey = (actor: Person, keyId: string) =>
    ctx.call(
      {
        method: "DELETE",
        path: `/admin/users/${ctx.people[actor].userId}/api-keys/${keyId}`,
      },
      ctx.as.cookie("instanceAdmin"),
    );
  const deactivate = (actor: Person) =>
    ctx.call(
      {
        method: "POST",
        path: `/admin/users/${ctx.people[actor].userId}/deactivate`,
      },
      ctx.as.cookie("instanceAdmin"),
    );

  for (const [name, family] of Object.entries(FAMILIES)) {
    it(
      `${name}: a key revoked or a user deactivated while it waits`,
      {
        timeout: 120_000,
      },
      async () => {
        for (const member of family) {
          const revoked = await raceUnderLock(member, true, async (_s, key) => {
            expect((await revokeKey(member.actor, key.id)).status).toBe(200);
          });
          expect([member.action, "key", revoked]).toEqual([
            member.action,
            "key",
            {
              cell: { status: 403, code: "CREDENTIAL_REVOKED" },
              unchanged: true,
              events: [],
            },
          ]);
          await db
            .update(schema.userTable)
            .set({ banned: false })
            .where(eq(schema.userTable.id, ctx.people[member.actor].userId));
          const banned = await raceUnderLock(member, false, async () => {
            expect((await deactivate(member.actor)).status).toBe(200);
          });
          expect([member.action, "ban", banned]).toEqual([
            member.action,
            "ban",
            {
              cell: { status: 403, code: "ACCOUNT_DISABLED" },
              unchanged: true,
              events: [],
            },
          ]);
          // The deactivation ended the actor's sessions: sign in again.
          await reactivate(member.actor);
        }
      },
    );
  }

  async function reactivate(actor: Person) {
    expect(
      (
        await ctx.call(
          {
            method: "POST",
            path: `/admin/users/${ctx.people[actor].userId}/reactivate`,
          },
          ctx.as.cookie("instanceAdmin"),
        )
      ).status,
    ).toBe(200);
    const { signIn } = await import("./helpers/auth-session");
    ctx.people[actor].cookies = await signIn(
      ctx.app,
      `${actor.toLowerCase()}@example.com`,
    );
  }

  it(
    "completes a write whose re-read ran before the revoke or the ban committed",
    {
      timeout: 60_000,
    },
    async () => {
      for (const how of ["key", "ban"] as const) {
        const s = await ctx.seed("admin");
        const target = s.userIds.target!;
        const key = await ctx.keyFor("admin", { member: ["delete"] });
        // An older removal marker gives the request a row to wait on after
        // its authorization reads: the removal upserts it.
        await db
          .insert(workspaceMemberRemovalTable)
          .values({ workspaceId: s.workspaceId, userId: target });
        const marker = await holdRowLock("workspace_member_removal", {
          workspace_id: s.workspaceId,
          user_id: target,
        });
        let pending: Promise<Response> | undefined;
        try {
          pending = ctx.call(
            ACTIONS["member.remove"]!(s),
            how === "key" ? ctx.as.key(key.key) : ctx.as.cookie("admin"),
          );
          await waitForLockWaiters(1);
          const revoke =
            how === "key"
              ? await revokeKey("admin", key.id)
              : await deactivate("admin");
          expect(revoke.status).toBe(200);
        } finally {
          await marker.release();
        }
        const response = await pending!;
        expect([how, response.status]).toEqual([how, 200]);
        expect(
          (await snapshot(s.workspaceId)).members.map((m) => m.userId),
        ).not.toContain(target);
        if (how === "ban") await reactivate("admin");
        // Every authorization read after the commit refuses.
        const next = await ctx.cell(
          ACTIONS["member.role"]!(await ctx.seed("admin")),
          how === "key" ? ctx.as.key(key.key) : ctx.as.cookie("admin"),
        );
        if (how === "key") expect(next.status).toBe(401);
      }
    },
  );
});
