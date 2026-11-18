import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import getWorkspaces from "@/fetchers/workspace/get-workspaces";
import { WORKSPACES_QUERY_KEY } from "@/hooks/queries/workspace/workspace-query-keys";
import { pickActiveWorkspace } from "@/lib/last-workspace/pick-active-workspace";
import { readRememberedWorkspace } from "@/lib/last-workspace/remembered-workspace";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/settings/workspace",
)({
  // Workspace settings have no workspace in the URL. They show this tab's
  // remembered workspace, else the first one (`useActiveWorkspace`). Only a
  // user with neither has nothing to show here.
  beforeLoad: async ({ context }) => {
    if (context.sessionError) return;
    const userId = context.session?.user?.id;
    if (!userId) return; // parent redirects unauthenticated users
    if (readRememberedWorkspace(userId)) return;

    let workspaces: Awaited<ReturnType<typeof getWorkspaces>> = [];
    try {
      workspaces = await context.queryClient.fetchQuery({
        queryKey: WORKSPACES_QUERY_KEY,
        queryFn: getWorkspaces,
      });
    } catch (error) {
      if (import.meta.env.DEV) console.warn("getWorkspaces failed", error);
      throw redirect({ to: "/onboarding" });
    }
    if (pickActiveWorkspace(undefined, null, workspaces).kind === "none")
      throw redirect({ to: "/onboarding" });
  },
  component: Outlet,
});
