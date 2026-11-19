import { resolveFileSecret } from "./file-secret";

/**
 * OAuth client credentials for linking a GitHub account to a signed-in user.
 * They never enable GitHub sign-in or sign-up. `GITHUB_OAUTH_*` keeps them
 * apart from the GitHub App env vars.
 */
export function getGithubSsoOAuthCredentials(): {
  clientId: string;
  clientSecret: string;
} {
  const clientId = process.env.GITHUB_OAUTH_CLIENT_ID?.trim() || "";
  const clientSecret =
    (clientId && resolveFileSecret("GITHUB_OAUTH_CLIENT_SECRET")?.trim()) || "";
  return clientId && clientSecret
    ? { clientId, clientSecret }
    : { clientId: "", clientSecret: "" };
}

export function isGithubSsoConfigured(): boolean {
  const { clientId, clientSecret } = getGithubSsoOAuthCredentials();
  return Boolean(clientId && clientSecret);
}
