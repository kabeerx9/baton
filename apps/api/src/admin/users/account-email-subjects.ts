import type { AccountPasswordPurpose } from "@baton/email";

const subjects: Record<AccountPasswordPurpose | "verification", string> = {
  setup: "Set up your {{instanceName}} account",
  reset: "Choose a new {{instanceName}} password",
  verification: "Confirm your email address for {{instanceName}}",
};

export function accountEmailSubject(
  kind: keyof typeof subjects,
  instanceName = "Baton",
) {
  return subjects[kind].replace("{{instanceName}}", () => instanceName);
}
