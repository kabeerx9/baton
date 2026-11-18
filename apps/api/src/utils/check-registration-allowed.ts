import { getInstanceSettings } from "../instance-settings/get-instance-settings";

type RegistrationCheckResult = { allowed: boolean; reason: string };

/** Open registration, or none: join links admit people who already have an account. */
export async function checkRegistrationAllowed(): Promise<RegistrationCheckResult> {
  if ((await getInstanceSettings()).registrationEnabled) {
    return { allowed: true, reason: "Registration is enabled" };
  }
  return {
    allowed: false,
    reason:
      "Registration is currently disabled. Ask an administrator to create your account.",
  };
}
