import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { signUpWithSession } from "./helpers/auth-session";
import { resetTestDatabase } from "./helpers/database";

beforeEach(resetTestDatabase);
afterEach(() => {
  process.env.DISABLE_REGISTRATION = "false";
});

async function setup(
  role: string,
  permission?: Record<string, string[]>,
  invitationRole = "admin",
) {
  const { app } = createApp();
  const owner = await signUpWithSession(app, {
    email: "owner@example.com",
    name: "Owner",
  });
  const viewer = await signUpWithSession(app, {
    email: "viewer@example.com",
    name: "Viewer",
  });
  const [workspace] = await db
    .insert(schema.workspaceTable)
    .values({ name: "Team", slug: randomUUID(), createdAt: new Date() })
    .returning();
  await db.insert(schema.workspaceUserTable).values([
    {
      workspaceId: workspace.id,
      userId: owner.userId,
      role: "owner",
      joinedAt: new Date(),
    },
    {
      workspaceId: workspace.id,
      userId: viewer.userId,
      role,
      joinedAt: new Date(),
    },
  ]);
  if (permission) {
    await db.insert(schema.workspaceRoleTable).values({
      workspaceId: workspace.id,
      role,
      permission: JSON.stringify(permission),
      createdAt: new Date(),
    });
  }
  const [invitation] = await db
    .insert(schema.invitationTable)
    .values({
      workspaceId: workspace.id,
      inviterId: owner.userId,
      email: "invitee@example.com",
      role: invitationRole,
      status: "pending",
      expiresAt: new Date(Date.now() + 86_400_000),
    })
    .returning();
  const invitations = async (cookies: string, full: boolean, status = 200) => {
    const path = full ? "get-full-organization" : "list-invitations";
    const response = await app.request(
      `/api/auth/organization/${path}?organizationId=${workspace.id}`,
      { headers: { cookie: cookies } },
    );
    expect(response.status).toBe(status);
    if (status !== 200) return [];
    const body = await response.json();
    return full ? body.invitations : body;
  };
  return { app, owner, viewer, invitation, invitations };
}

describe("workspace invitation visibility", () => {
  it.each(["viewer", "member", "demoted-admin"])(
    "hides invitations from a %s without invitation:create on both endpoints",
    async (role) => {
      const { owner, viewer, invitation, invitations } = await setup(
        role === "demoted-admin" ? "admin" : role,
        role === "demoted-admin" ? {} : undefined,
      );
      for (const full of [false, true]) {
        expect(
          await invitations(
            viewer.cookies,
            full,
            full && role === "demoted-admin" ? 403 : 200,
          ),
        ).toEqual([]);
        expect(await invitations(owner.cookies, full)).toEqual([
          expect.objectContaining({ id: invitation.id }),
        ]);
      }
    },
  );

  it("preserves invitation visibility for a custom inviter role", async () => {
    const { viewer, invitation, invitations } = await setup("inviter", {
      invitation: ["create"],
      workspace: ["read"],
    });
    for (const full of [false, true]) {
      expect(await invitations(viewer.cookies, full)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: invitation.id }),
        ]),
      );
    }
  });

  it.each([false, true])(
    "lets an invited email sign up but refuses the invitation (invite-only=%s)",
    async (inviteOnly) => {
      const { app, invitation } = await setup("viewer");
      process.env.DISABLE_REGISTRATION = String(inviteOnly);
      const signup = await app.request("/api/auth/sign-up/email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: invitation.email,
          name: "Invitee",
          password: "correct horse battery staple",
          invitationId: invitation.id,
        }),
      });
      expect(signup.status).toBe(200);
      const { token, user } = (await signup.json()) as {
        token: string;
        user: { emailVerified: boolean };
      };
      expect(user.emailVerified).toBe(false);
      // Join links replaced email invites: accepting now answers 410.
      const accepted = await app.request(
        "/api/auth/organization/accept-invitation",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ invitationId: invitation.id }),
        },
      );
      expect(accepted.status).toBe(410);
      expect(await accepted.json()).toMatchObject({
        code: "INVITATIONS_REMOVED",
      });
    },
  );
});
