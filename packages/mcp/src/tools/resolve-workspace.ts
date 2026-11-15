import type { ToolClient } from "./register.js";

type Workspace = { id: string; name: string; slug?: string };

/**
 * Pick the workspace for a board tool: the one named (id, name or slug), else
 * the grant's default, else the user's only workspace. Otherwise the error
 * lists the valid names, so the agent can retry with one.
 */
export async function resolveWorkspaceId(
  client: ToolClient,
  input: string | undefined,
  defaultWorkspaceId: string | null | undefined,
): Promise<string> {
  const workspaces = await client.json<Workspace[]>("/api/workspace");
  const names = () =>
    workspaces.length
      ? workspaces.map((workspace) => `"${workspace.name}"`).join(", ")
      : "none";
  const wanted = input?.trim();
  if (wanted) {
    const lower = wanted.toLowerCase();
    const match =
      workspaces.find((workspace) => workspace.id === wanted) ??
      workspaces.find(
        (workspace) =>
          workspace.name.toLowerCase() === lower ||
          workspace.slug?.toLowerCase() === lower,
      );
    if (match) return match.id;
    throw new Error(`No workspace "${wanted}". Your workspaces: ${names()}.`);
  }
  const fallback =
    workspaces.find((workspace) => workspace.id === defaultWorkspaceId) ??
    (workspaces.length === 1 ? workspaces[0] : undefined);
  if (fallback) return fallback.id;
  throw new Error(`Pass workspaceId as one of your workspaces: ${names()}.`);
}
