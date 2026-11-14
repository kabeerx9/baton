import { resolveFileSecret } from "./file-secret";

/**
 * OAuth client credentials for linking a GitHub account to a signed-in user.
 * They never enable GitHub sign-in or sign-up. Prefer `GITHUB_OAUTH_*` so the
 * GitHub App env vars stay separate. Legacy `GITHUB_CLIENT_*` is still read.
 */
export function getGithubSsoOAuthCredentials(): {
  clientId: string;
  clientSecret: string;
} {
  const oauthId = process.env.GITHUB_OAUTH_CLIENT_ID?.trim();
  const oauthSecret =
    oauthId && resolveFileSecret("GITHUB_OAUTH_CLIENT_SECRET")?.trim();
  if (oauthId && oauthSecret) {
    return { clientId: oauthId, clientSecret: oauthSecret };
  }
  const clientId = process.env.GITHUB_CLIENT_ID?.trim() || "";
  return {
    clientId,
    clientSecret:
      (clientId && resolveFileSecret("GITHUB_CLIENT_SECRET")?.trim()) || "",
  };
}

export function isGithubSsoConfigured(): boolean {
  const { clientId, clientSecret } = getGithubSsoOAuthCredentials();
  return Boolean(clientId && clientSecret);
}
