import type { GetConfigResponse } from "@/fetchers/config/get-config";

export type SignInFooter = "createAccount" | "inviteOnly";

type Config = GetConfigResponse | undefined;

/** Email and password is the only sign-in method. */
export function isPasswordSignUpEnabled(
  config: Config,
  isInstanceAdminSetup: boolean,
) {
  if (isInstanceAdminSetup) return true;
  // Wait for the config before offering a form the instance may refuse.
  return Boolean(config) && !config?.disablePasswordRegistration;
}

export function getSignInFooter(config: Config): SignInFooter {
  return config?.disableRegistration || config?.disablePasswordRegistration
    ? "inviteOnly"
    : "createAccount";
}

export function getSafeRedirectPath(path: string | undefined) {
  return path?.startsWith("/") && !path.includes("//") ? path : undefined;
}
