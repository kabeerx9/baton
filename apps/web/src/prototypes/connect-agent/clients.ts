import type { ClientId } from "./types";

export type ClientInfo = { id: ClientId; name: string; blurb: string };

export const CLIENTS: readonly ClientInfo[] = [
  {
    id: "claude-code",
    name: "Claude Code",
    blurb: "One command, then sign in",
  },
  { id: "codex", name: "Codex CLI", blurb: "One command, then sign in" },
  {
    id: "opencode",
    name: "OpenCode",
    blurb: "Edit opencode.json, then sign in",
  },
  { id: "cursor", name: "Cursor", blurb: "Edit mcp.json, then sign in" },
  {
    id: "claude-desktop",
    name: "Claude Desktop",
    blurb: "Custom connector or API key",
  },
  { id: "headless", name: "Headless", blurb: "Bearer API key in a header" },
];
