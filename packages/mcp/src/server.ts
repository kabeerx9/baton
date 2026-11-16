import { createRequire } from "node:module";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { BatonClient } from "./baton/client.js";
import { readServerConfig } from "./server-config.js";
import {
  MCP_SERVER_INSTRUCTIONS,
  parseToolCatalog,
  registerTools,
} from "./tools/register.js";

const require = createRequire(import.meta.url);
const { version: packageVersion } = require("../package.json") as {
  version: string;
};

export function createMcpServer(): McpServer {
  const client = new BatonClient(readServerConfig(process.env));
  const server = new McpServer(
    { name: "baton-mcp", version: packageVersion },
    { instructions: MCP_SERVER_INSTRUCTIONS },
  );
  // Same catalog choice as the HTTP endpoint: core unless BATON_MCP_TOOLS=all.
  registerTools(server, {
    client,
    catalog: parseToolCatalog(process.env.BATON_MCP_TOOLS),
  });
  return server;
}
