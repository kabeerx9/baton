import { APIError } from "better-auth/api";
import { getInstanceSettings } from "../instance-settings/get-instance-settings";
import { checkRegistrationAllowed } from "./check-registration-allowed";
import { hasRegisteredUsers } from "./instance-bootstrap";
import { isCloud } from "./is-cloud";
import { isDisposableEmail } from "./is-disposable-email";

export function normalizeInvitationId(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.trim();
  return /^[a-z0-9_-]{1,128}$/i.test(normalized) ? normalized : undefined;
}

function disposableEmailError() {
  return new APIError("BAD_REQUEST", {
    code: "DISPOSABLE_EMAIL_NOT_ALLOWED",
    message:
      "Use a permanent email address. Disposable addresses cannot create accounts.",
  });
}

export async function assertUserRegistrationAllowed(
  user: { email: string },
  context?: { invitationId?: unknown },
): Promise<void> {
  if (!(await hasRegisteredUsers())) return;
  if (isCloud() && isDisposableEmail(user.email)) throw disposableEmailError();
  if (!(await getInstanceSettings()).passwordRegistrationEnabled) {
    throw new APIError("FORBIDDEN", {
      code: "LOCAL_REGISTRATION_DISABLED",
      message:
        "Account registration is disabled. Ask an administrator to create your account.",
    });
  }
  const result = await checkRegistrationAllowed(
    user.email,
    normalizeInvitationId(context?.invitationId),
  );
  if (!result.allowed)
    throw new APIError("FORBIDDEN", {
      code: "REGISTRATION_NOT_ALLOWED",
      message: result.reason,
    });
}
