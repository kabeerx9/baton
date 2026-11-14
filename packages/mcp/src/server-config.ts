import { normalizeBaseUrl } from "./utils/normalize-base-url.js";

export const MISSING_API_KEY_MESSAGE =
  "BATON_API_KEY is required. Create an API key in Baton under Settings > Account > Developer, then set BATON_API_KEY in your MCP client config.";

export class MissingApiKeyError extends Error {
  constructor() {
    super(MISSING_API_KEY_MESSAGE);
    this.name = "MissingApiKeyError";
  }
}

export type ServerConfig = { baseUrl: string; apiKey: string };

/** Read the stdio server's settings. An API key is the only way to sign in. */
export function readServerConfig(
  env: Record<string, string | undefined>,
): ServerConfig {
  const apiKey = env.BATON_API_KEY?.trim();
  if (!apiKey) throw new MissingApiKeyError();
  return {
    baseUrl: normalizeBaseUrl(env.BATON_API_URL || "http://localhost:1337"),
    apiKey,
  };
}
