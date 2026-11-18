import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useEffect } from "react";
import Layout from "@/components/common/layout";
import WorkspaceArchived from "@/components/common/workspace-archived";
import useAuth from "@/components/providers/auth-provider/hooks/use-auth";
import { workspaceQueryOptions } from "@/hooks/queries/workspace/workspace-query-options";
import { isWorkspaceArchivedError } from "@/lib/is-workspace-archived-error";
import { enterWorkspaceRoute } from "@/lib/last-workspace/enter-workspace-route";
import {
  forgetWorkspace,
  rememberWorkspace,
} from "@/lib/last-workspace/remembered-workspace";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId",
)({
  // The URL is the active workspace. Nothing under it renders until its own
  // read says the user may see it.
  beforeLoad: async ({ params, context, preload }) => {
    const entry = await enterWorkspaceRoute(() =>
      context.queryClient.ensureQueryData(
        workspaceQueryOptions(params.workspaceId),
      ),
    );
    if (entry.status === "refused") {
      // Forget it, or "/dashboard" would send the user straight back.
      const userId = context.session?.user?.id;
      if (userId && !preload) forgetWorkspace(userId, params.workspaceId);
      throw redirect({ to: "/dashboard" });
    }
    if (entry.status === "failed") {
      throw entry.error instanceof Error
        ? entry.error
        : new Error("Could not open this workspace");
    }
  },
  component: RouteComponent,
});

function RouteComponent() {
  const { workspaceId } = Route.useParams();
  const userId = useAuth().user?.id;
  const { data, error } = useQuery(workspaceQueryOptions(workspaceId));
  // Never remember an archived workspace or one the user is not a member of.
  const opened = data !== undefined && data.role !== null && !error;

  // Remember on render, not in `beforeLoad`: a hover preload runs that too.
  useEffect(() => {
    if (opened && userId) rememberWorkspace(userId, workspaceId);
  }, [opened, userId, workspaceId]);

  if (isWorkspaceArchivedError(error)) return <WorkspaceArchived />;

  return (
    <Layout>
      <Outlet />
    </Layout>
  );
}
