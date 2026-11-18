import type { SignUpDecision } from "../identity/port";
import { getInstanceSettings } from "../instance-settings/get-instance-settings";
import { checkRegistrationAllowed } from "./check-registration-allowed";
import { hasRegisteredUsers } from "./instance-bootstrap";
import { isCloud } from "./is-cloud";
import { isDisposableEmail } from "./is-disposable-email";

/** Whether a new account may be created for this email. The body of `IdentityHooks.canSignUp`. */
export async function signUpDecision(user: {
  email: string;
}): Promise<SignUpDecision> {
  if (!(await hasRegisteredUsers())) return { ok: true };
  if (isCloud() && isDisposableEmail(user.email)) {
    return {
      ok: false,
      code: "DISPOSABLE_EMAIL_NOT_ALLOWED",
      message:
        "Use a permanent email address. Disposable addresses cannot create accounts.",
    };
  }
  if (!(await getInstanceSettings()).passwordRegistrationEnabled) {
    return {
      ok: false,
      code: "LOCAL_REGISTRATION_DISABLED",
      message:
        "Account registration is disabled. Ask an administrator to create your account.",
    };
  }
  const result = await checkRegistrationAllowed();
  if (!result.allowed) {
    return {
      ok: false,
      code: "REGISTRATION_NOT_ALLOWED",
      message: result.reason,
    };
  }
  return { ok: true };
}
