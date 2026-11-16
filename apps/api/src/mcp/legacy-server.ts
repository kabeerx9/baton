import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { MCP_SERVER_INSTRUCTIONS } from "@baton/mcp/tools";
import {
  type McpToolOptions,
  registerMcpTools,
  toMcpToolRegistrar,
} from "./tools";
import { MCP_MAX_TOOL_INPUT_ELEMENTS } from "./request-bounds";

export function createMcpServerForUser(
  token: string,
  internalApiUrl: string,
  options: McpToolOptions,
): McpServer {
  const server = new McpServer(
    { name: "baton-mcp", version: "1.0.0" },
    {
      maxToolInputElements: MCP_MAX_TOOL_INPUT_ELEMENTS,
      instructions: MCP_SERVER_INSTRUCTIONS,
    },
  );
  registerMcpTools(toMcpToolRegistrar(server), internalApiUrl, token, options);
  return server;
}
