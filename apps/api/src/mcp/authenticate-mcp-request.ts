import { verifyApiKey } from "../utils/verify-api-key";
import { verifyAccessToken } from "./grant/verify-access-token";
import { isMcpToken } from "./grant/token-secret";
import { mcpResource } from "./urls";

export type McpPrincipal =
  | {
      kind: "grant";
      token: string;
      userId: string;
      grantId: string;
      defaultWorkspaceId: string | null;
    }
  | { kind: "api_key"; token: string; userId: string };

/**
 * `/api/mcp` accepts an MCP access token bound to this endpoint, or an API key
 * checked exactly as REST checks it. A browser session token is refused.
 */
export async function authenticateMcpRequest(
  req: Request,
): Promise<McpPrincipal | null> {
  const match = req.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i);
  const token = match?.[1];
  if (!token) return null;

  if (isMcpToken(token)) {
    const grant = await verifyAccessToken(token);
    if (!grant || grant.resource !== mcpResource()) return null;
    return {
      kind: "grant",
      token,
      userId: grant.userId,
      grantId: grant.grantId,
      defaultWorkspaceId: grant.defaultWorkspaceId,
    };
  }

  const apiKey = await verifyApiKey(token);
  if (apiKey?.status !== "valid") return null;
  return { kind: "api_key", token, userId: apiKey.key.userId };
}
