import { eq } from "drizzle-orm";
import db, { schema } from "../database";
import { readStoredSettings } from "../instance-settings/read-stored-settings";
import { revokeUserGrants } from "../mcp/grant/revoke-grants";
import { promoteInitialAdministrator } from "../utils/instance-bootstrap";
import { signUpDecision } from "../utils/registration-policy";
import { isBanActive } from "../utils/user-ban";
import { revokeSessionConnections, revokeUserConnections } from "../ws";
import type { IdentityHooks } from "./port";

/** Baton's answers to the provider. Each rule lives in its own Baton module. */
export const batonIdentityHooks: IdentityHooks = {
  canSignUp: signUpDecision,
  async canSignIn({ userId }) {
    const [user] = await db
      .select({
        banned: schema.userTable.banned,
        banExpires: schema.userTable.banExpires,
      })
      .from(schema.userTable)
      .where(eq(schema.userTable.id, userId))
      .limit(1);
    return Boolean(user) && !isBanActive(user);
  },
  async userCreated({ userId }) {
    await db
      .update(schema.userTable)
      .set({ role: (await readStoredSettings()).defaultRole })
      .where(eq(schema.userTable.id, userId));
    await promoteInitialAdministrator(userId);
  },
  userDeleted: revokeUserConnections,
  sessionsEnded: revokeSessionConnections,
  async passwordReset(userId) {
    await revokeUserGrants(userId);
  },
};
