import { eq } from "drizzle-orm";
import db from "../../database";
import { userTable } from "../../database/schema";
import { ApiError } from "../../errors/api-error";
import { identity } from "../../identity";
import { readStoredSettings } from "../../instance-settings/read-stored-settings";
import { isCloud } from "../../utils/is-cloud";
import { isDisposableEmail } from "../../utils/is-disposable-email";
import type { AdminAuditRequest } from "../audit/admin-audit-request";
import { recordAdminAction } from "../audit/record-admin-action";
import { assertAssignableRole } from "../roles/assert-assignable-role";
import { getUserAccess } from "../roles/get-instance-access";
import { emailPasswordLink } from "../users/account-email-links";
import { adminUserColumns, toAdminUser } from "../users/admin-user-columns";

type CreateUserInput = {
  name: string;
  email: string;
  /** Defaults to the instance's default role. */
  role?: string;
};

export type PasswordSetupEmail = "sent" | "failed" | "not_configured";

function emailTaken() {
  return new ApiError(409, {
    code: "USER_ALREADY_EXISTS",
    message: "A user with this email address already exists.",
  });
}

/**
 * Create an account without a password. The person gets a single-use link to
 * choose one.
 */
async function createUser(input: CreateUserInput, audit: AdminAuditRequest) {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  if (isCloud() && isDisposableEmail(email)) {
    throw new ApiError(400, {
      code: "DISPOSABLE_EMAIL_NOT_ALLOWED",
      message:
        "Use a permanent email address. Disposable addresses cannot create accounts.",
    });
  }
  const actor = await getUserAccess(audit.actorUserId ?? "");

  const userId = await db.transaction(async (tx) => {
    const role = input.role ?? (await readStoredSettings(tx)).defaultRole;
    await assertAssignableRole(role, actor, tx);
    const created = await identity.users.create(tx, { name, email });
    if (!created) throw emailTaken();
    // The instance role is Baton's column, set in the same transaction.
    await tx
      .update(userTable)
      .set({ role })
      .where(eq(userTable.id, created.userId));

    await recordAdminAction(
      {
        ...audit,
        action: "user.created",
        targetType: "user",
        targetId: created.userId,
        targetLabel: email,
        metadata: {
          name,
          role,
          signIn: "password_link",
        },
      },
      tx,
    );
    return created.userId;
  });

  let passwordSetupEmail: PasswordSetupEmail;
  try {
    const result = await emailPasswordLink(
      { id: userId, name, email },
      "setup",
    );
    passwordSetupEmail = result.success ? "sent" : "not_configured";
  } catch {
    passwordSetupEmail = "failed";
  }

  const [row] = await db
    .select(adminUserColumns)
    .from(userTable)
    .where(eq(userTable.id, userId))
    .limit(1);
  if (!row)
    throw new ApiError(404, { code: "NOT_FOUND", message: "User not found" });
  return { user: toAdminUser(row), passwordSetupEmail };
}

export default createUser;
