import {
  type AccountPasswordPurpose,
  type EmailResult,
  isSmtpConfigured,
  sendAccountPasswordEmail,
  sendEmailVerificationEmail,
} from "@baton/email";
import { identity } from "../../identity";
import { accountEmailSubject } from "./account-email-subjects";
import type { AdminTargetUser } from "./find-admin-target-user";

type Recipient = Pick<AdminTargetUser, "id" | "name" | "email">;

const notConfigured: EmailResult = {
  success: false,
  reason: "SMTP_NOT_CONFIGURED",
};

/**
 * Email a link to choose a password, the same single-use link as a
 * self-service reset. The link is never returned. Throws when the SMTP server
 * rejects the message.
 */
export async function emailPasswordLink(
  user: Recipient,
  purpose: AccountPasswordPurpose,
): Promise<EmailResult> {
  if (!isSmtpConfigured()) return notConfigured;
  return sendAccountPasswordEmail(
    user.email,
    (name) => accountEmailSubject(purpose, name),
    {
      purpose,
      passwordLink: await identity.credentials.passwordSetupLink(
        user.id,
        purpose,
      ),
      userName: user.name,
    },
  );
}

/**
 * Email a link that marks the address verified. Throws when the SMTP server
 * rejects the message.
 */
export async function emailVerificationLink(
  user: Recipient,
): Promise<EmailResult> {
  if (!isSmtpConfigured()) return notConfigured;
  return sendEmailVerificationEmail(
    user.email,
    (name) => accountEmailSubject("verification", name),
    {
      verificationLink: await identity.credentials.emailVerificationLink(
        user.id,
      ),
      userName: user.name,
    },
  );
}
