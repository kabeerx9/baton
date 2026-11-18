import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import Layout from "@/components/common/layout";
import WorkspaceArchived from "@/components/common/workspace-archived";
import useWorkspaceArchived from "@/hooks/queries/workspace/use-workspace-archived";
import { authClient } from "@/lib/auth-client";
import { enterWorkspace } from "@/lib/enter-workspace";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId",
)({
  // The URL is the active workspace. Settings and destructive actions read the
  // session, so make it agree before any child renders.
  beforeLoad: async ({ params, context }) => {
    const entry = await enterWorkspace({
      workspaceId: params.workspaceId,
      sessionActiveId:
        context.session?.session?.activeOrganizationId ?? undefined,
      setActive: (workspaceId) =>
        authClient.organization.setActive({ organizationId: workspaceId }),
    });
    // "/dashboard" picks the user's first workspace and activates it.
    if (entry.status === "not-member") throw redirect({ to: "/dashboard" });
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
  const isArchived = useWorkspaceArchived(workspaceId);

  if (isArchived) return <WorkspaceArchived />;

  return (
    <Layout>
      <Outlet />
    </Layout>
  );
}
