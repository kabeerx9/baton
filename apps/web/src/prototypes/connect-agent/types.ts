// Shapes typed to the planned API: GET /api/mcp/grants, DELETE /api/mcp/grants/{id}.
export type McpGrant = {
  id: string;
  /** Self-reported by the agent when it registers. Never verified. */
  clientName: string;
  workspace: { id: string; name: string } | null;
  createdAt: string;
  /** Prototype assumption: null until the first call. The brief does not say. */
  lastUsedAt: string | null;
};

export type Scenario =
  | "normal"
  | "empty"
  | "loading"
  | "error"
  | "localhost"
  | "lan";

export const SCENARIOS: readonly { id: Scenario; label: string }[] = [
  { id: "normal", label: "Normal" },
  { id: "empty", label: "Empty" },
  { id: "loading", label: "Loading" },
  { id: "error", label: "Error" },
  { id: "localhost", label: "Localhost" },
  { id: "lan", label: "LAN http" },
];

export type ClientId =
  | "claude-code"
  | "codex"
  | "opencode"
  | "cursor"
  | "claude-desktop"
  | "headless";
