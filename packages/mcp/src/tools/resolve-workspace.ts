import type { ToolClient } from "./register.js";

type Workspace = { id: string; name: string; slug?: string };

const describe = (workspace: Workspace) =>
  workspace.slug
    ? `"${workspace.name}" (slug ${workspace.slug}, id ${workspace.id})`
    : `"${workspace.name}" (id ${workspace.id})`;

/**
 * Find the one workspace a text reference names. Precedence, first tier with
 * a match wins: exact id, slug (any case), exact name, name in any case.
 * Names are not unique, so two matches in one tier are an error, never a guess.
 */
function matchWorkspace(
  workspaces: Workspace[],
  wanted: string,
): Workspace | undefined {
  const lower = wanted.toLowerCase();
  const tiers: Array<(workspace: Workspace) => boolean> = [
    (workspace) => workspace.id === wanted,
    (workspace) => workspace.slug?.toLowerCase() === lower,
    (workspace) => workspace.name === wanted,
    (workspace) => workspace.name.toLowerCase() === lower,
  ];
  for (const tier of tiers) {
    const matches = workspaces.filter(tier);
    if (matches.length === 1) return matches[0];
    if (matches.length > 1) {
      throw new Error(
        `"${wanted}" matches ${matches.length} workspaces: ${matches.map(describe).join(", ")}. Pass the id or slug.`,
      );
    }
  }
  return undefined;
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
