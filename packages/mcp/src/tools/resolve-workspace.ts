import type { ToolClient } from "./register.js";

type Workspace = { id: string; name: string; slug?: string };

const describe = (workspace: Workspace) =>
  workspace.slug
    ? `"${workspace.name}" (slug ${workspace.slug}, id ${workspace.id})`
    : `"${workspace.name}" (id ${workspace.id})`;

/**
 * Find the one workspace a text reference names. An exact id always wins.
 * Otherwise the text must match exactly one workspace by name or slug,
 * ignoring case; names are not unique, so any second match is an error.
 */
function matchWorkspace(
  workspaces: Workspace[],
  wanted: string,
): Workspace | undefined {
  const byId = workspaces.find((workspace) => workspace.id === wanted);
  if (byId) return byId;
  const lower = wanted.toLowerCase();
  const matches = workspaces.filter(
    (workspace) =>
      workspace.name.toLowerCase() === lower ||
      workspace.slug?.toLowerCase() === lower,
  );
  if (matches.length > 1) {
    throw new Error(
      `"${wanted}" matches ${matches.length} workspaces: ${matches.map(describe).join(", ")}. Nothing was changed. Pass the id.`,
    );
  }
  return matches[0];
}

/**
 * Pick the workspace for a board tool: the one named, else the grant's
 * default, else the user's only workspace. Otherwise the error lists the
 * workspaces, so the agent can retry with one.
 */
export async function resolveWorkspaceId(
  client: ToolClient,
  input: string | undefined,
  defaultWorkspaceId: string | null | undefined,
): Promise<string> {
  const workspaces = await client.json<Workspace[]>("/api/workspace");
  const all = () =>
    workspaces.length ? workspaces.map(describe).join(", ") : "none";
  const wanted = input?.trim();
  if (wanted) {
    const match = matchWorkspace(workspaces, wanted);
    if (match) return match.id;
    throw new Error(`No workspace "${wanted}". Your workspaces: ${all()}.`);
  }
  const fallback =
    workspaces.find((workspace) => workspace.id === defaultWorkspaceId) ??
    (workspaces.length === 1 ? workspaces[0] : undefined);
  if (fallback) return fallback.id;
  throw new Error(`Pass workspaceId as one of your workspaces: ${all()}.`);
}
