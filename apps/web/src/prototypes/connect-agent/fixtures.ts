import type { ClientId, McpGrant } from "./types";

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

const WORKSPACE = { id: "ws_wicketry", name: "Wicketry" };

/** Fixtures are built from `now` so relative times stay true whenever the page loads. */
export function makeGrants(now: number): McpGrant[] {
  const ago = (ms: number) => new Date(now - ms).toISOString();
  return [
    {
      id: "grant_cc01",
      clientName: "Claude Code",
      workspace: WORKSPACE,
      createdAt: ago(21 * DAY),
      lastUsedAt: ago(2 * HOUR),
    },
    {
      id: "grant_cx02",
      clientName: "Codex",
      workspace: WORKSPACE,
      createdAt: ago(9 * DAY),
      lastUsedAt: ago(DAY),
    },
    {
      id: "grant_cu03",
      clientName: "Cursor",
      workspace: null,
      createdAt: ago(34 * DAY),
      lastUsedAt: ago(5 * DAY),
    },
    {
      id: "grant_oc04",
      clientName: "OpenCode",
      workspace: WORKSPACE,
      createdAt: ago(94 * DAY),
      lastUsedAt: ago(61 * DAY),
    },
  ];
}

const NAME_BY_CLIENT: Record<ClientId, string> = {
  "claude-code": "Claude Code",
  codex: "Codex",
  opencode: "OpenCode",
  cursor: "Cursor",
  "claude-desktop": "Claude",
  headless: "Script",
};

/** The grant that appears when the viewer finishes sign-in (steps variant). */
export function makeConnectedGrant(client: ClientId, now: number): McpGrant {
  return {
    id: `grant_new_${now}`,
    clientName: NAME_BY_CLIENT[client],
    workspace: WORKSPACE,
    createdAt: new Date(now).toISOString(),
    lastUsedAt: new Date(now).toISOString(),
  };
}
