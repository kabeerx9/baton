import { getApiUrl } from "@/fetchers/get-api-url";
import { HttpError } from "@/lib/http-error";

export const GRANTS_PAGE_SIZE = 20;

export type McpGrant = {
  id: string;
  /** Self-reported by the agent when it registers. Never verified. */
  clientName: string;
  /** The agent's default workspace, or null when none was chosen. */
  workspace: { id: string; name: string } | null;
  createdAt: string;
  lastUsedAt: string;
};

export type McpGrantsPage = {
  grants: McpGrant[];
  nextCursor: string | null;
};

// `/api/mcp/*` is not part of the typed `@baton/libs` client (the API leaves
// the MCP router out of `AppType`), so this uses the project's `getApiUrl`
// and `HttpError` helpers directly, as the other MCP fetchers do.
/** One page of the caller's connected agents, newest first. */
export async function listMcpGrants(cursor?: string): Promise<McpGrantsPage> {
  const query = new URLSearchParams({ limit: String(GRANTS_PAGE_SIZE) });
  if (cursor) query.set("cursor", cursor);
  const response = await fetch(getApiUrl(`/mcp/grants?${query}`), {
    credentials: "include",
  });
  if (!response.ok) {
    throw await HttpError.fromResponse(response);
  }
  return response.json();
}
