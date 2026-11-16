import { getApiUrl } from "@/fetchers/get-api-url";

export async function submitMcpAuthorizationDecision(
  requestId: string,
  approved: boolean,
  workspaceId?: string,
): Promise<string> {
  const response = await fetch(
    getApiUrl(`/mcp/authorize/request/${encodeURIComponent(requestId)}`),
    {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        approved,
        ...(workspaceId ? { workspaceId } : {}),
      }),
    },
  );
  if (!response.ok) {
    throw new Error("Could not complete the authorization request.");
  }

  const body = (await response.json()) as { redirect: string };
  return body.redirect;
}
