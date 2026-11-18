import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { checkRegistrationAllowed } from "../../apps/api/src/utils/check-registration-allowed";
import { resetTestDatabase } from "./helpers/database";
import { createWorkspaceMember } from "./helpers/fixtures";

// Email invitations are gone (auth-boundary §9, decision 7): an old pending
// invitation row no longer opens closed registration.
describe("API integration: registration without invitations", () => {
  beforeEach(async () => {
    await resetTestDatabase();
    process.env.DISABLE_REGISTRATION = "true";
  });

  afterEach(() => {
    process.env.DISABLE_REGISTRATION = "false";
  });

  it("refuses a signup while closed, even with a pending invitation row", async () => {
    const inviter = await createWorkspaceMember({ role: "owner" });
    await db.insert(schema.invitationTable).values({
      workspaceId: inviter.workspace.id,
      inviterId: inviter.user.id,
      email: `invited-${randomUUID()}@example.com`,
      role: "member",
      status: "pending",
      expiresAt: new Date(Date.now() + 86_400_000),
    });

    expect((await checkRegistrationAllowed()).allowed).toBe(false);
  });

  it("allows any signup once registration is open again", async () => {
    process.env.DISABLE_REGISTRATION = "false";
    expect((await checkRegistrationAllowed()).allowed).toBe(true);
  });
});
