/**
 * How a request authenticated, set by the server in
 * `authenticate-api-request.ts`. Never read from a client-supplied flag.
 */
export type AuthMethod = "cookie" | "bearer" | "api_key" | "mcp";

/**
 * "web" for a browser session cookie; "agent" for an API key, a bearer
 * session token or an MCP OAuth access token. It names the credential, not proof of who typed.
 */
export type Channel = "web" | "agent";

export function channelFor(method: AuthMethod | undefined): Channel | null {
  if (!method) return null;
  return method === "cookie" ? "web" : "agent";
}
