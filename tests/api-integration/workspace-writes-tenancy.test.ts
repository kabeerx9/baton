import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { signUpWithSession } from "./helpers/auth-session";
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
    "gives a non-member instance admin 403 MEMBERSHIP_REQUIRED on every write",
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
        ]).toEqual([action, { status: 403, code: "MEMBERSHIP_REQUIRED" }]);
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

describe("the provider organization endpoints are gone (A10)", () => {
  it("answers 404 on every /api/auth/organization path", async () => {
    const b = await ctx.seed("owner");
    for (const path of [
      "create",
      "update",
      "delete",
      "leave",
      "list",
      "set-active",
      "get-full-organization",
      "list-members",
      "get-active-member",
      "remove-member",
      "update-member-role",
      "invite-member",
      "accept-invitation",
      "cancel-invitation",
      "list-invitations",
      "has-permission",
      "create-role",
      "update-role",
      "delete-role",
      "list-roles",
      "check-slug",
      "create-team",
      "",
    ]) {
      for (const method of ["GET", "POST"] as const) {
        const response = await ctx.app.request(
          `/api/auth/organization/${path}?organizationId=${b.workspaceId}`,
          {
            method,
            headers: {
              ...ctx.as.cookie("owner"),
              "content-type": "application/json",
              origin: "http://localhost:5173",
            },
            body:
              method === "POST"
                ? JSON.stringify({ organizationId: b.workspaceId })
                : undefined,
          },
        );
        expect([method, path, response.status]).toEqual([method, path, 404]);
      }
    }
  });

  it("leaves no /organization string in the provider config", () => {
    const source = readFileSync(
      resolve(
        import.meta.dirname,
        "../../apps/api/src/identity/better-auth/auth.ts",
      ),
      "utf8",
    );
    expect(source).not.toContain("/organization");
  });

  it("signs up without an active organization, which has no column now", async () => {
    const person = await signUpWithSession(ctx.app, {
      email: "fresh@example.com",
      name: "Fresh",
    });
    const sessions = await db
      .select({ id: schema.sessionTable.id })
      .from(schema.sessionTable)
      .where(eq(schema.sessionTable.userId, person.userId));
    expect(sessions.length).toBeGreaterThan(0);
    const columns = await db.execute<{ column_name: string }>(sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'session'
        AND column_name = 'active_organization_id'`);
    expect(columns.rows).toEqual([]);
  });
});
