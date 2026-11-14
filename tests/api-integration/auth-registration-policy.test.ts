import * as email from "@baton/email";
import { eq } from "drizzle-orm";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import getInstanceStatus from "../../apps/api/src/instance/controllers/get-instance-status";
import { promoteInitialAdministrator } from "../../apps/api/src/utils/instance-bootstrap";
import { assertUserRegistrationAllowed } from "../../apps/api/src/utils/registration-policy";
import { resetTestDatabase } from "./helpers/database";
import { createWorkspaceMember } from "./helpers/fixtures";

const headers = {
  "content-type": "application/json",
  Origin: "http://localhost:5173",
};

function post(
  path: string,
  body: unknown,
  extraHeaders: Record<string, string> = {},
) {
  return createApp().app.request(`/api/auth${path}`, {
    method: "POST",
    headers: { ...headers, ...extraHeaders },
    body: JSON.stringify(body),
  });
}
function signup(email: string, extraHeaders?: Record<string, string>) {
  return post(
    "/sign-up/email",
    { name: "Test", email, password: "test-password-at-least-12" },
    extraHeaders,
  );
}
async function invitation(email: string) {
  const inviter = await createWorkspaceMember({ role: "owner" });
  const [row] = await db
    .insert(schema.invitationTable)
    .values({
      email,
      workspaceId: inviter.workspace.id,
      inviterId: inviter.user.id,
      role: "member",
      status: "pending",
      expiresAt: new Date(Date.now() + 60_000),
    })
    .returning();
  return row;
}

describe("auth registration and bootstrap boundaries", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });
  afterEach(() => vi.unstubAllEnvs());

  it("has no anonymous sign-in and lets the first password sign-up bootstrap the instance", async () => {
    expect((await post("/sign-in/anonymous", {})).status).toBe(404);
    expect(await db.select().from(schema.userTable)).toHaveLength(0);
    expect(await getInstanceStatus()).toEqual({
      hasUsers: false,
      hasAdmin: false,
    });
    vi.stubEnv("DISABLE_REGISTRATION", "true");
    expect((await signup("first@example.com")).status).toBe(200);
    expect(await getInstanceStatus()).toEqual({
      hasUsers: true,
      hasAdmin: true,
    });
    expect(
      await db
        .select()
        .from(schema.userTable)
        .where(eq(schema.userTable.role, "admin")),
    ).toEqual([expect.objectContaining({ email: "first@example.com" })]);
  });

  it("elects exactly one admin when multiple first users already exist before the after-hooks", async () => {
    await db.insert(schema.userTable).values(
      ["first", "second"].map((id) => ({
        id,
        name: id,
        email: `${id}@example.com`,
        createdAt: new Date("2026-01-01"),
      })),
    );
    await Promise.all([
      promoteInitialAdministrator("second"),
      promoteInitialAdministrator("first"),
    ]);
    expect(
      await db
        .select()
        .from(schema.userTable)
        .where(eq(schema.userTable.role, "admin")),
    ).toEqual([expect.objectContaining({ id: "first" })]);
  });

  it("keeps one admin through concurrent HTTP first signups", async () => {
    const responses = await Promise.all(
      [1, 2, 3, 4].map((n) => signup(`race-${n}@example.com`)),
    );
    expect(responses.map((r) => r.status)).toEqual([200, 200, 200, 200]);
    expect(
      await db
        .select()
        .from(schema.userTable)
        .where(eq(schema.userTable.role, "admin")),
    ).toHaveLength(1);
  });

  it("does not give a new signup admin rights on an older instance lacking an admin", async () => {
    const { user } = await createWorkspaceMember();
    // Make the historical account unambiguously older across DB/app clocks.
    await db
      .update(schema.userTable)
      .set({ createdAt: new Date("2020-01-01") })
      .where(eq(schema.userTable.id, user.id));
    expect((await signup("new@example.com")).status).toBe(200);
    expect(
      await db
        .select()
        .from(schema.userTable)
        .where(eq(schema.userTable.role, "admin")),
    ).toHaveLength(0);
  });

  it("requires the matching invitation secret for password signup", async () => {
    const invite = await invitation("invitee@example.com");
    vi.stubEnv("DISABLE_REGISTRATION", "true");
    expect((await signup(invite.email)).status).toBe(403);
    expect(
      (await signup(invite.email, { "x-invitation-id": "wrong" })).status,
    ).toBe(403);
    expect(
      (await signup("other@example.com", { "x-invitation-id": invite.id }))
        .status,
    ).toBe(403);
    expect(
      (await signup(invite.email, { "x-invitation-id": invite.id })).status,
    ).toBe(200);
  });

  it("requires a valid invitation at the user-create boundary when registration is disabled", async () => {
    const invite = await invitation("invitee@example.com");
    vi.stubEnv("DISABLE_REGISTRATION", "true");
    await expect(
      assertUserRegistrationAllowed({ email: invite.email }),
    ).rejects.toMatchObject({ status: "FORBIDDEN" });
    await expect(
      assertUserRegistrationAllowed(
        { email: invite.email },
        { invitationId: "missing" },
      ),
    ).rejects.toMatchObject({ status: "FORBIDDEN" });
    await expect(
      assertUserRegistrationAllowed(
        { email: invite.email },
        { invitationId: invite.id },
      ),
    ).resolves.toBeUndefined();
  });

  it.each([
    "/sign-in/email-otp",
    "/email-otp/send-verification-otp",
    "/sign-in/magic-link",
    "/sign-in/social",
    "/sign-in/oauth2",
  ])("does not serve the removed %s sign-in route", async (path) => {
    await createWorkspaceMember();
    const response = await post(path, {
      email: "someone@example.com",
      provider: "google",
      type: "sign-in",
    });
    expect([403, 404]).toContain(response.status);
    expect(await db.select().from(schema.userTable)).toHaveLength(1);
    expect(await db.select().from(schema.verificationTable)).toHaveLength(0);
  });

  describe("cloud registration", () => {
    beforeEach(() => {
      vi.stubEnv("BATON_CLOUD", "true");
      vi.spyOn(email, "isSmtpConfigured").mockReturnValue(true);
    });

    it("rejects a password sign-up with a disposable address", async () => {
      await createWorkspaceMember();
      const response = await signup("throwaway@mailinator.com");
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({
        code: "DISPOSABLE_EMAIL_NOT_ALLOWED",
      });
      expect(await db.select().from(schema.userTable)).toHaveLength(1);
    });

    it("accepts a password sign-up with a permanent address", async () => {
      await createWorkspaceMember();
      expect((await signup("password-person@example.com")).status).toBe(200);
    });

    it("keeps password sign-up for the first account on a fresh instance", async () => {
      expect((await signup("first@example.com")).status).toBe(200);
    });
  });
});
