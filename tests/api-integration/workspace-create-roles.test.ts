import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import {
  DEFAULT_ROLE_NAMES,
  defaultRolePayloads,
} from "../../packages/permissions/src";
import { signUpWithSession } from "./helpers/auth-session";
import { resetTestDatabase } from "./helpers/database";

beforeEach(resetTestDatabase);

describe("POST /api/workspace", () => {
  it("seeds the default roles and makes the creator owner", async () => {
    const { app } = createApp();
    const owner = await signUpWithSession(app, {
      email: "creator@example.com",
      name: "Creator",
      role: "user",
    });
    const created = await app.request("/api/workspace", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: owner.cookies },
      body: JSON.stringify({ name: "Seeded" }),
    });
    expect(created.status).toBe(201);
    const { id } = (await created.json()) as { id: string };

    const roles = await db
      .select()
      .from(schema.workspaceRoleTable)
      .where(eq(schema.workspaceRoleTable.workspaceId, id));
    expect(
      Object.fromEntries(
        roles.map((row) => [row.role, JSON.parse(row.permission)]),
      ),
    ).toEqual(
      Object.fromEntries(
        DEFAULT_ROLE_NAMES.map((role) => [role, defaultRolePayloads[role]]),
      ),
    );

    const [membership] = await db
      .select()
      .from(schema.workspaceUserTable)
      .where(eq(schema.workspaceUserTable.workspaceId, id));
    expect(membership).toMatchObject({ userId: owner.userId, role: "owner" });
  });
});
