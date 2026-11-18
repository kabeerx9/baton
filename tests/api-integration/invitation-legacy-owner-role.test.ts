import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { signUpWithSession } from "./helpers/auth-session";
import { resetTestDatabase } from "./helpers/database";
import {
  invitationSecurityFixture,
  organizationRequest,
} from "./helpers/invitation-security";

beforeEach(resetTestDatabase);

describe("previously accepted ambiguous ownership", () => {
  it.each(["member, owner", "recruiter, owner", "admin, owner"])(
    "removes only the accidental ownership of %j without rewriting membership",
    async (role) => {
      const ctx = await invitationSecurityFixture(role);
      const capabilities = await ctx.app.request(
        `/api/workspace/${ctx.workspace.id}/capabilities`,
        {
          headers: { cookie: ctx.actor.cookies },
        },
      );
      expect(capabilities.status).toBe(200);
      expect(await capabilities.json()).toMatchObject({
        deleteWorkspace: false,
        inviteUsers: role !== "member, owner",
        deleteProjects: role === "admin, owner",
      });
      const promoted = await organizationRequest(
        ctx.app,
        { cookie: ctx.actor.cookies },
        "update-member-role",
        {
          organizationId: ctx.workspace.id,
          memberId: ctx.membership.id,
          role: ["member", " owner"],
        },
      );
      expect(promoted.status).toBe(403);
      // A second canonical owner makes the provider's last-owner check pass;
      // the malformed actor must still never acquire the right to remove one.
      const secondOwner = await signUpWithSession(ctx.app, {
        email: "second-owner@example.com",
        name: "Second owner",
        role: "user",
      });
      await db.insert(schema.workspaceUserTable).values({
        workspaceId: ctx.workspace.id,
        userId: secondOwner.userId,
        role: "owner",
        joinedAt: new Date(),
      });
      const removed = await organizationRequest(
        ctx.app,
        { cookie: ctx.actor.cookies },
        "remove-member",
        {
          organizationId: ctx.workspace.id,
          memberIdOrEmail: "owner@example.com",
        },
      );
      expect(removed.status).toBe(403);
      expect(await removed.json()).toMatchObject({
        code: "OWNER_ROLE_REVIEW_REQUIRED",
      });
      expect(
        await db.query.workspaceUserTable.findFirst({
          where: eq(schema.workspaceUserTable.id, ctx.membership.id),
        }),
      ).toEqual(ctx.membership);
      expect(
        await db.query.workspaceUserTable.findFirst({
          where: eq(schema.workspaceUserTable.userId, ctx.owner.userId),
        }),
      ).toBeDefined();
      // Only an explicit decision by a true owner can restore ownership.
      const reviewed = await organizationRequest(
        ctx.app,
        { cookie: ctx.owner.cookies },
        "update-member-role",
        {
          organizationId: ctx.workspace.id,
          memberId: ctx.membership.id,
          role: "member,owner",
        },
      );
      expect(reviewed.status).toBe(200);
    },
  );
});
