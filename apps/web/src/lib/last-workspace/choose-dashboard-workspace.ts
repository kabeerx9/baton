import { enterWorkspaceRoute } from "./enter-workspace-route";
import { pickActiveWorkspace } from "./pick-active-workspace";

export type DashboardChoice = {
  target: { kind: "workspace"; id: string } | { kind: "onboarding" };
  /** A remembered id that is refused or archived; the caller forgets it. */
  stale: string | null;
};

type Input = {
  remembered: string | null;
  workspaces: readonly { id: string; kind?: string | null }[];
  readWorkspace: (id: string) => Promise<{ role: string | null }>;
};

/**
 * Where `/dashboard` lands: this tab's remembered workspace if it still
 * reads, else the first one, else onboarding. A remembered id is confirmed
 * with its own read, so a stale id cannot bounce between two redirects.
 */
export async function chooseDashboardWorkspace({
  remembered,
  workspaces,
  readWorkspace,
}: Input): Promise<DashboardChoice> {
  let stale: string | null = null;
  const pick = pickActiveWorkspace(undefined, remembered, workspaces);
  if (pick.kind === "remembered") {
    const entry = await enterWorkspaceRoute(() => readWorkspace(pick.id));
    if (entry.status === "ready")
      return { target: { kind: "workspace", id: pick.id }, stale };
    if (entry.status === "failed") throw entry.error;
    stale = pick.id;
  }
  const next = pickActiveWorkspace(undefined, null, workspaces);
  return next.kind === "none"
    ? { target: { kind: "onboarding" }, stale }
    : { target: { kind: "workspace", id: next.id }, stale };
}
