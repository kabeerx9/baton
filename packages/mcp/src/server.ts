import { createRequire } from "node:module";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { BatonClient } from "./baton/client.js";
import { readServerConfig } from "./server-config.js";
import { registerTools } from "./tools/register.js";

const require = createRequire(import.meta.url);
const { version: packageVersion } = require("../package.json") as {
  version: string;
};

export function createMcpServer(): McpServer {
  const client = new BatonClient(readServerConfig(process.env));
  const server = new McpServer({
    name: "baton-mcp",
    version: packageVersion,
  });
  registerTools(server, { client });
  return server;
}
