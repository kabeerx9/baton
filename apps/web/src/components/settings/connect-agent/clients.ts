import type { ClientId } from "./types";

// Product names are not translated.
export const CLIENTS: readonly { id: ClientId; name: string }[] = [
  { id: "claude-code", name: "Claude Code" },
  { id: "codex", name: "Codex CLI" },
  { id: "opencode", name: "OpenCode" },
  { id: "cursor", name: "Cursor" },
  { id: "claude-desktop", name: "Claude Desktop" },
  { id: "headless", name: "Headless" },
];
