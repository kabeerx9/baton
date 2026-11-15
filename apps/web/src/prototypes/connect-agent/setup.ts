import type { InstanceKind } from "./instance";
import type { ClientId } from "./types";

export type SetupCode = {
  /** File to edit, shown above the code. Absent for shell commands. */
  path?: string;
  text: string;
};

export type SetupStep = {
  title: string;
  /** Plain sentence under the title. */
  body?: string;
  code?: SetupCode;
  /** Link to the API keys page, for steps that need a key. */
  keysLink?: boolean;
};

const json = (value: unknown) => JSON.stringify(value, null, 2);

/** The exact one-time setup for a client, with the real instance URL filled in. */
export function buildSetup(
  client: ClientId,
  url: string,
  kind: InstanceKind,
): SetupStep[] {
  switch (client) {
    case "claude-code":
      return [
        {
          title: "Add Baton",
          code: {
            text: `claude mcp add --transport http --scope user baton ${url}`,
          },
        },
        {
          title: "Sign in once",
          body: "In Claude Code, run /mcp, choose baton, then Authenticate. Your browser opens.",
          code: { text: "/mcp" },
        },
      ];
    case "codex":
      return [
        {
          title: "Add Baton",
          code: { text: `codex mcp add baton --url ${url}` },
        },
        {
          title: "Sign in once",
          body: "Your browser opens. Approve access.",
          code: { text: "codex mcp login baton" },
        },
      ];
    case "opencode":
      return [
        {
          title: "Add Baton to your config",
          code: {
            path: "opencode.json",
            text: json({ mcp: { baton: { type: "remote", url } } }),
          },
        },
        {
          title: "Sign in once",
          body: "Your browser opens. Approve access.",
          code: { text: "opencode mcp auth baton" },
        },
      ];
    case "cursor":
      return [
        {
          title: "Add Baton to your config",
          code: {
            path: "~/.cursor/mcp.json",
            text: json({ mcpServers: { baton: { url } } }),
          },
        },
        {
          title: "Sign in once",
          body: "Open Settings, then MCP, then choose Login next to baton.",
        },
      ];
    case "claude-desktop":
      if (kind === "https") {
        return [
          {
            title: "Add a custom connector",
            body: "Open Settings, then Connectors, then Add custom connector. Paste the MCP URL.",
          },
          {
            title: "Sign in once",
            body: "Claude opens your browser. Approve access.",
          },
        ];
      }
      return [
        {
          title: "Create an API key",
          body: "Claude Desktop cannot reach a private instance as a connector. Use an API key instead.",
          keysLink: true,
        },
        {
          title: "Run baton-mcp with the key",
          body: "Point baton-mcp at the MCP URL and give it the key.",
        },
      ];
    case "headless":
      return [
        {
          title: "Send the key as a header",
          body: "Create an API key, then add this header to every request to the MCP URL.",
          code: { text: "Authorization: Bearer <API key>" },
          keysLink: true,
        },
      ];
  }
}
