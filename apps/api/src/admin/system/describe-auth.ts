import {
  DEFAULT_STORED_SETTINGS,
  type InstanceSettings,
  resolveInstanceSettings,
} from "../../instance-settings/resolve-instance-settings";
import { getGithubSsoOAuthCredentials } from "../../utils/github-sso-env";
import type { ServiceStatus } from "./service-status";

export type AuthProvider = {
  id: "github";
  name: string;
  status: ServiceStatus;
};

function env(name: string) {
  return process.env[name]?.trim() ?? "";
}

function githubStatus(): ServiceStatus {
  try {
    const { clientId, clientSecret } = getGithubSsoOAuthCredentials();
    if (clientId && clientSecret) return "ok";
  } catch {
    // An invalid secret file is a configuration warning, not a failed status page.
  }
  return [
    "GITHUB_OAUTH_CLIENT_ID",
    "GITHUB_OAUTH_CLIENT_SECRET",
    "GITHUB_OAUTH_CLIENT_SECRET_FILE",
  ].some((name) => env(name))
    ? "warning"
    : "not_configured";
}

/**
 * How people sign in on this instance. Only booleans and display names leave
 * here: never client ids, secrets, or provider URLs. GitHub only links an
 * account for repository connections; it is not a sign-in method.
 */
export function describeAuth(
  instance: InstanceSettings = resolveInstanceSettings(
    DEFAULT_STORED_SETTINGS,
    process.env,
  ),
) {
  const disableRegistration = !instance.registrationEnabled;
  const providers: AuthProvider[] = [
    {
      id: "github",
      name: "GitHub",
      // Same resolution as account linking, so a mixed pair isn't shown as usable.
      status: githubStatus(),
    },
  ];

  return {
    registration: !disableRegistration,
    passwordRegistration:
      !disableRegistration && instance.passwordRegistrationEnabled,
    workspaceCreation: !instance.workspaceCreationRestricted,
    providers,
  };
}
