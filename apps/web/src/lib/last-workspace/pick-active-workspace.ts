export type WorkspacePick =
  | { kind: "route"; id: string }
  | { kind: "remembered"; id: string }
  | { kind: "first"; id: string }
  | { kind: "none" };

type Listed = { id: string; kind?: string | null };

/**
 * Which workspace a screen is about. A route id always wins and is never
 * replaced. A remembered id need not be in the list: the list leaves out the
 * demo workspace, and its read decides whether the id is still usable.
 */
export function pickActiveWorkspace(
  routeId: string | undefined,
  remembered: string | null | undefined,
  workspaces: readonly Listed[],
): WorkspacePick {
  if (routeId) return { kind: "route", id: routeId };
  if (remembered) return { kind: "remembered", id: remembered };
  const first = workspaces.find((workspace) => workspace.kind !== "demo");
  return first ? { kind: "first", id: first.id } : { kind: "none" };
}
