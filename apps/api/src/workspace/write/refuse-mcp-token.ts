import type { Context, Next } from "hono";
import { mcpTokenNotAllowedError } from "../../utils/require-member-permission";

/** Agent (MCP) tokens never create workspaces (auth-boundary §3). */
export async function refuseMcpToken(c: Context, next: Next) {
  if (c.get("authMethod") === "mcp") throw mcpTokenNotAllowedError();
  return next();
}
