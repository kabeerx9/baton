// Member writes answer with the change only, never member data, and tell
// open clients to refetch members and capabilities over WebSocket.
import { eq } from "drizzle-orm";
import type { WSContext } from "hono/ws";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import db, { getDatabase, schema } from "../../apps/api/src/database";
import {
  addConnection,
  addUserConnection,
  removeConnection,
  removeUserConnection,
} from "../../apps/api/src/ws";
import { resetTestDatabase } from "./helpers/database";
import { holdRowLock, releaseWhenQueued } from "./helpers/row-lock";
import {
  ACTIONS,
  type Seeded,
  type WritesFixture,
  writesFixture,
} from "./helpers/workspace-writes";

let ctx: WritesFixture;

beforeEach(async () => {
  await resetTestDatabase();
  ctx = await writesFixture();
});

/** Fails when a body carries any person's email, name or image. */
async function changeOnly(response: Response) {
  const text = await response.text();
  expect(text).not.toMatch(/@example\.com|"name"|"email"|"image"/);
  return JSON.parse(text) as Record<string, unknown>;
}

async function addRole(s: Seeded, role: string, permission: object) {
  const [row] = await db
    .insert(schema.workspaceRoleTable)
    .values({
      workspaceId: s.workspaceId,
      role,
      permission: JSON.stringify(permission),
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning({ id: schema.workspaceRoleTable.id });
  return row!.id;
}

describe("member writes return no member data", () => {
  it("answers a member:update-only key with the change", async () => {
    const s = await ctx.seed("owner");
    const key = (await ctx.keyFor("owner", { member: ["update"] })).key;
    const changed = await ctx.call(ACTIONS["member.role"]!(s), ctx.as.key(key));
    expect(changed.status).toBe(200);
    expect(await changeOnly(changed)).toEqual({
      workspaceId: s.workspaceId,
      userId: s.userIds.target,
      role: "viewer",
    });
    // The key cannot read the list it no longer gets back.
    const list = await ctx.call(ACTIONS["members.list"]!(s), ctx.as.key(key));
    expect(list.status).toBe(403);

    const transferred = await ctx.call(
      ACTIONS["member.transfer"]!(s),
      ctx.as.key(key),
    );
    expect(transferred.status).toBe(200);
    expect(await changeOnly(transferred)).toEqual({
      workspaceId: s.workspaceId,
      ownerId: s.userIds.target,
      previousOwnerId: ctx.people.owner.userId,
    });
  });

  it("answers an actor whose role names no read with the change only", async () => {
    const s = await ctx.seed("member");
    await addRole(s, "updater", { member: ["update", "delete"] });
    await db
      .update(schema.workspaceUserTable)
      .set({ role: "updater" })
      // The `member` person acts with a role that names no read.
      .where(eq(schema.workspaceUserTable.userId, ctx.people.member.userId));
    const as = ctx.as.cookie("member");
    // Membership alone grants workspace:read, so the list is open to them.
    expect((await ctx.call(ACTIONS["members.list"]!(s), as)).status).toBe(200);

    const changed = await ctx.call(ACTIONS["member.role"]!(s), as);
    expect(changed.status).toBe(200);
    expect(await changeOnly(changed)).toEqual({
      workspaceId: s.workspaceId,
      userId: s.userIds.target,
      role: "viewer",
    });
    const removed = await ctx.call(ACTIONS["member.remove"]!(s), as);
    expect(removed.status).toBe(200);
    expect(await changeOnly(removed)).toEqual({
      workspaceId: s.workspaceId,
      userId: s.userIds.target,
    });
  });

  it("answers a self-removal with the removal only", async () => {
    const s = await ctx.seed("owner");
    const removed = await ctx.call(
      {
        method: "DELETE",
        path: `/workspace/${s.workspaceId}/members/${ctx.people.owner.userId}`,
      },
      ctx.as.cookie("owner"),
    );
    expect(removed.status).toBe(200);
    expect(await changeOnly(removed)).toEqual({
      workspaceId: s.workspaceId,
      userId: ctx.people.owner.userId,
    });
  });

  it("answers two queued removals with their own removal only", async () => {
    const s = await ctx.seed("owner");
    const lock = await holdRowLock("workspace", s.workspaceId);
    const [first, second] = await releaseWhenQueued(lock, [
      {
        start: () => [
          ctx.call(ACTIONS["member.remove"]!(s), ctx.as.cookie("owner")),
        ],
        waiters: 1,
      },
      {
        start: () => [
          ctx.call(
            {
              method: "DELETE",
              path: `/workspace/${s.workspaceId}/members/${ctx.people.owner.userId}`,
            },
            ctx.as.cookie("owner2"),
          ),
        ],
        waiters: 2,
      },
    ]);
    expect(first.status).toBe(200);
    expect(await changeOnly(first)).toEqual({
      workspaceId: s.workspaceId,
      userId: s.userIds.target,
    });
    expect(second.status).toBe(200);
    expect(await changeOnly(second)).toEqual({
      workspaceId: s.workspaceId,
      userId: ctx.people.owner.userId,
    });
  });
});

describe("member writes reach open clients (event → WebSocket)", () => {
  function listen(userId: string) {
    const ws = { send: vi.fn(), close: vi.fn() };
    const connection = addUserConnection(userId, ws as unknown as WSContext);
    const messages = () =>
      ws.send.mock.calls.map(
        ([raw]) =>
          JSON.parse(raw as string) as {
            type: string;
            workspaceId?: string;
          },
      );
    return {
      messages,
      stop: () => removeUserConnection(userId, connection),
    };
  }

  const writes: Record<
    string,
    {
      actor: "owner" | "member";
      request: (s: Seeded) => Parameters<WritesFixture["call"]>[0];
    }
  > = {
    "role change": {
      actor: "owner",
      request: (s) => ACTIONS["member.role"]!(s),
    },
    removal: { actor: "owner", request: (s) => ACTIONS["member.remove"]!(s) },
    transfer: {
      actor: "owner",
      request: (s) => ACTIONS["member.transfer"]!(s),
    },
    "role edit": {
      actor: "owner",
      request: (s) => ACTIONS["roles.update"]!(s),
    },
    "role delete": {
      actor: "owner",
      request: (s) => ACTIONS["roles.delete"]!(s),
    },
    leave: { actor: "member", request: (s) => ACTIONS["workspace.leave"]!(s) },
  };

  for (const [name, write] of Object.entries(writes)) {
    it(`sends WORKSPACE_MEMBERS_UPDATED to other members after a ${name}`, async () => {
      const s = await ctx.seed(write.actor);
      const other = listen(ctx.people.owner2.userId);
      try {
        const response = await ctx.call(
          write.request(s),
          ctx.as.cookie(write.actor),
        );
        expect(response.status).toBe(200);
        await vi.waitFor(() =>
          expect(other.messages()).toContainEqual({
            type: "WORKSPACE_MEMBERS_UPDATED",
            workspaceId: s.workspaceId,
          }),
        );
      } finally {
        other.stop();
      }
    });
  }
});

describe("socket revocation after removal", () => {
  it("needs no user lookup after commit", async () => {
    const s = await ctx.seed("owner");
    const target = s.userIds.target!;
    const ws = { send: vi.fn(), close: vi.fn() };
    const conn = addConnection(
      "project",
      ws as unknown as WSContext,
      target,
      "window",
      s.workspaceId,
    );
    // Any role read outside a transaction fails, as the old post-commit
    // lookup could.
    const select = getDatabase().select.bind(getDatabase());
    const spy = vi.spyOn(getDatabase(), "select").mockImplementation(((
      fields?: Record<string, unknown>,
    ) => {
      if (
        fields &&
        Object.keys(fields).length === 1 &&
        fields.role === schema.userTable.role
      )
        throw new Error("post-commit role lookup unavailable");
      return select(fields as never);
    }) as never);
    try {
      const response = await ctx.call(
        ACTIONS["member.remove"]!(s),
        ctx.as.cookie("owner"),
      );
      expect(response.status).toBe(200);
      expect(ws.close).toHaveBeenCalledWith(1008, "Workspace access revoked");
    } finally {
      spy.mockRestore();
      removeConnection("project", conn);
    }
  });
});
