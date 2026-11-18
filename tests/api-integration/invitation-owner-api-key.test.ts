import { randomUUID } from "node:crypto";
import * as email from "@baton/email";
import { eq, inArray } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { resetTestDatabase } from "./helpers/database";
import {
  invitationSecurityFixture,
  organizationRequest,
} from "./helpers/invitation-security";

beforeEach(resetTestDatabase);

async function createKey(
  ctx: Awaited<ReturnType<typeof invitationSecurityFixture>>,
  cookies: string,
  permissions: Record<string, string[]> | null,
) {
  const response = await ctx.app.request("/api/auth/api-key/create", {
    method: "POST",
    headers: { cookie: cookies, "content-type": "application/json" },
    body: JSON.stringify({ name: "Invitation authorization" }),
  });
  expect(response.status).toBe(200);
  const key = (await response.json()) as { id: string; key: string };
  await db
    .update(schema.apikeyTable)
    .set({
      rateLimitEnabled: false,
      ...(permissions === null
        ? {}
        : { permissions: JSON.stringify(permissions) }),
    })
    .where(eq(schema.apikeyTable.id, key.id));
  return key;
}

describe("API key removal targets", () => {
  const cases = [false, true].flatMap((bearer) =>
    ["admin, owner", "owner"].map((role) => ({ bearer, role })),
  );

  it.each(cases)(
    "does not inherit an active workspace (bearer=$bearer, role=$role)",
    async ({ bearer, role }) => {
      const ctx = await invitationSecurityFixture("owner");
      const keys: Awaited<ReturnType<typeof createKey>>[] = [];
      for (const permissions of [
        { invitation: ["create"], member: ["delete"] },
        null,
      ]) {
        keys.push(await createKey(ctx, ctx.actor.cookies, permissions));
      }
      await db
        .update(schema.workspaceUserTable)
        .set({ role })
        .where(eq(schema.workspaceUserTable.id, ctx.membership.id));
      await db
        .update(schema.sessionTable)
        .set({ activeOrganizationId: ctx.workspace.id })
        .where(
          inArray(schema.sessionTable.userId, [
            ctx.actor.userId,
            ctx.owner.userId,
          ]),
        );
      // A second canonical owner prevents the last-owner check from masking
      // an unauthorized removal if the key ever inherits a browser target.
      const [otherOwner] = await db
        .insert(schema.userTable)
        .values({
          id: randomUUID(),
          email: "other-owner@example.com",
          emailVerified: true,
          name: "Other owner",
        })
        .returning();
      await db.insert(schema.workspaceUserTable).values({
        workspaceId: ctx.workspace.id,
        userId: otherOwner.id,
        role: "owner",
        joinedAt: new Date(),
      });
      const pending = await ctx.pending("member, owner");
      const members = await db
        .select()
        .from(schema.workspaceUserTable)
        .orderBy(schema.workspaceUserTable.id);
      const send = vi.spyOn(email, "sendWorkspaceInvitationEmail");

      for (const key of keys) {
        const headers = {
          cookie: ctx.owner.cookies,
          ...(bearer
            ? { authorization: `Bearer ${key.key}` }
            : { "x-api-key": key.key }),
        };
        const session = await ctx.app.request("/api/auth/get-session", {
          headers,
        });
        expect(session.status).toBe(200);
        const viewer = await session.json();
        expect(viewer).toMatchObject({
          user: { id: ctx.actor.userId },
          session: { id: key.id },
        });
        expect(viewer.session.activeOrganizationId).toBeUndefined();

        for (const organizationId of [undefined, ""]) {
          const removed = await organizationRequest(
            ctx.app,
            headers,
            "remove-member",
            { organizationId, memberIdOrEmail: "owner@example.com" },
          );
          expect(removed.status).toBe(400);
          expect(await removed.json()).toMatchObject({
            code: "NO_ACTIVE_ORGANIZATION",
          });
        }

        // With an explicit target, a malformed actor is denied before member removal.
        if (role !== "owner") {
          const removed = await organizationRequest(
            ctx.app,
            headers,
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
        }
      }
      expect(
        await db.query.invitationTable.findFirst({
          where: eq(schema.invitationTable.id, pending.id),
        }),
      ).toEqual(pending);
      expect(
        await db
          .select()
          .from(schema.workspaceUserTable)
          .orderBy(schema.workspaceUserTable.id),
      ).toEqual(members);
      expect(send).not.toHaveBeenCalled();
    },
  );
});
