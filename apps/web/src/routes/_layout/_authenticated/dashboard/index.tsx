import { createFileRoute, redirect } from "@tanstack/react-router";
import getWorkspaces from "@/fetchers/workspace/get-workspaces";
import { WORKSPACES_QUERY_KEY } from "@/hooks/queries/workspace/workspace-query-keys";
import { workspaceQueryOptions } from "@/hooks/queries/workspace/workspace-query-options";
import { handleUnauthorized, isUnauthorizedError } from "@/lib/http-error";
import { chooseDashboardWorkspace } from "@/lib/last-workspace/choose-dashboard-workspace";
import {
  forgetWorkspace,
  readRememberedWorkspace,
} from "@/lib/last-workspace/remembered-workspace";

export const Route = createFileRoute("/_layout/_authenticated/dashboard/")({
  beforeLoad: async ({ context, preload }) => {
    const { queryClient } = context;
    const userId = context.session?.user?.id;
    let choice: Awaited<ReturnType<typeof chooseDashboardWorkspace>>;
    try {
      const workspaces = await queryClient.fetchQuery({
        queryKey: WORKSPACES_QUERY_KEY,
        queryFn: getWorkspaces,
        staleTime: 0,
      });
      choice = await chooseDashboardWorkspace({
        remembered: userId ? readRememberedWorkspace(userId) : null,
        workspaces,
        readWorkspace: (id) =>
          queryClient.ensureQueryData(workspaceQueryOptions(id)),
      });
    } catch (error) {
      if (isUnauthorizedError(error)) {
        handleUnauthorized();
        return;
      }
      throw error;
    }

    if (choice.stale && userId && !preload)
      forgetWorkspace(userId, choice.stale);
    if (choice.target.kind === "onboarding")
      throw redirect({ to: "/onboarding" });
    throw redirect({
      to: "/dashboard/workspace/$workspaceId",
      params: { workspaceId: choice.target.id },
    });
  },
});
