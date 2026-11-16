import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { signUpWithSession } from "./helpers/auth-session";
import { resetTestDatabase } from "./helpers/database";

beforeEach(resetTestDatabase);

describe("Better Auth team membership", () => {
  it("creates a workspace and updates the default team's membership count", async () => {
    const { app } = createApp();
    const owner = await signUpWithSession(app, {
      name: "Dependency Owner",
      email: "dependency@example.com",
    });
    const request = (path: string, body: object) =>
      app.request(`/api/auth/organization/${path}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Origin: "http://localhost:5173",
          cookie: owner.cookies,
        },
        body: JSON.stringify(body),
      });
    const created = await request("create", {
      name: "Dependencies",
      slug: "dependencies",
    });
    expect(created.status).toBe(200);
    const workspace = (await created.json()) as { id: string };
    const [team] = await db
      .select()
      .from(schema.teamTable)
      .where(eq(schema.teamTable.workspaceId, workspace.id));
    expect(team.memberCount).toBe(1);
    const [member] = await db.select().from(schema.teamMemberTable);
    expect(member.membershipKey).toEqual(expect.any(String));

    const membership = {
      teamId: team.id,
      userId: owner.userId,
      organizationId: workspace.id,
    };
    expect((await request("remove-team-member", membership)).status).toBe(200);
    expect(
      (
        await db
          .select()
          .from(schema.teamTable)
          .where(eq(schema.teamTable.id, team.id))
      )[0]?.memberCount,
    ).toBe(0);
    expect((await request("add-team-member", membership)).status).toBe(200);
    expect(
      (
        await db
          .select()
          .from(schema.teamTable)
          .where(eq(schema.teamTable.id, team.id))
      )[0]?.memberCount,
    ).toBe(1);
  });
});
