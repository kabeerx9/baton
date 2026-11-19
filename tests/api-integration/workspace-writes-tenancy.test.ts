import { beforeEach, describe, expect, it } from "vite-plus/test";
import { resetTestDatabase } from "./helpers/database";
import {
  ACTIONS,
  WRITE_ACTIONS,
  type WritesFixture,
  snapshot,
  writesFixture,
} from "./helpers/workspace-writes";

let ctx: WritesFixture;

beforeEach(async () => {
  await resetTestDatabase();
  ctx = await writesFixture();
});

describe("tenancy (A1)", () => {
  it(
    "refuses a member of workspace A every route of workspace B, by session and by key",
    {
      timeout: 60_000,
    },
    async () => {
      // `viewer` owns A and is not in B.
      await ctx.seed("viewer", { role: "owner" });
      const key = (await ctx.keyFor("viewer", null)).key;
      for (const action of Object.keys(ACTIONS)) {
        for (const headers of [ctx.as.cookie("viewer"), ctx.as.key(key)]) {
          const b = await ctx.seed("owner");
          const before = await snapshot(b.workspaceId);
          const got = await ctx.cell(ACTIONS[action]!(b), headers);
          expect([action, [403, 404].includes(got.status)]).toEqual([
            action,
            true,
          ]);
          expect(await snapshot(b.workspaceId), action).toEqual(before);
        }
      }
    },
  );

  it(
    "gives a non-member instance admin 404 on every write",
    {
      timeout: 60_000,
    },
    async () => {
      for (const action of WRITE_ACTIONS) {
        const b = await ctx.seed("owner");
        const before = await snapshot(b.workspaceId);
        expect([
          action,
          await ctx.cell(ACTIONS[action]!(b), ctx.as.cookie("instanceAdmin")),
        ]).toMatchObject([action, { status: 404 }]);
        expect(await snapshot(b.workspaceId), action).toEqual(before);
      }
    },
  );

  it(
    "holds an instance admin who is a viewer to the viewer role",
    {
      timeout: 60_000,
    },
    async () => {
      for (const action of WRITE_ACTIONS) {
        if (action === "workspace.leave") continue; // A viewer may leave.
        const b = await ctx.seed("instanceAdmin", { role: "viewer" });
        const before = await snapshot(b.workspaceId);
        const got = await ctx.cell(
          ACTIONS[action]!(b),
          ctx.as.cookie("instanceAdmin"),
        );
        expect([action, got.status]).toEqual([action, 403]);
        expect(await snapshot(b.workspaceId), action).toEqual(before);
      }
    },
  );

  it(
    "refuses an owner's MCP token every write and still lets it read",
    {
      timeout: 60_000,
    },
    async () => {
      const token = await ctx.mcpTokenFor("owner");
      for (const action of WRITE_ACTIONS) {
        const b = await ctx.seed("owner");
        const before = await snapshot(b.workspaceId);
        expect([
          action,
          await ctx.cell(ACTIONS[action]!(b), ctx.as.bearer(token)),
        ]).toEqual([action, { status: 403, code: "MCP_TOKEN_NOT_ALLOWED" }]);
        expect(await snapshot(b.workspaceId), action).toEqual(before);
      }
      const created = await ctx.cell(
        { method: "POST", path: "/workspace", body: { name: "Agent" } },
        ctx.as.bearer(token),
      );
      expect(created).toEqual({ status: 403, code: "MCP_TOKEN_NOT_ALLOWED" });

      const b = await ctx.seed("owner");
      const list = await ctx.call(
        { method: "GET", path: "/workspace" },
        ctx.as.bearer(token),
      );
      expect(list.status).toBe(200);
      expect(
        ((await list.json()) as Array<{ id: string }>).map((row) => row.id),
      ).toContain(b.workspaceId);
      const members = await ctx.call(
        ACTIONS["members.list"]!(b),
        ctx.as.bearer(token),
      );
      expect(members.status).toBe(200);
      expect(await members.json()).toHaveLength(3);
    },
  );
});
